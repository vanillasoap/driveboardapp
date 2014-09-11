
import os
import sys
import time
import json
import threading
import serial
import serial.tools.list_ports
from config import conf


__author__  = 'Stefan Hechenberger <stefan@nortd.com>'



################ SENDING PROTOCOL
CMD_STOP = '!'
CMD_RESUME = '~'
CMD_STATUS = '?'

CMD_RASTER_DATA_START = '\x02'
CMD_RASTER_DATA_END = '\x03'

CMD_NONE = "A"
CMD_LINE = "B"
CMD_DWELL = "C"
CMD_RASTER = "D"

# CMD_SET_FEEDRATE = "E"
# CMD_SET_INTENSITY = "F"

# CMD_REF_RELATIVE = "G" 
# CMD_REF_ABSOLUTE = "H"

CMD_HOMING = "I"

CMD_SET_OFFSET_TABLE = "J"
CMD_SET_OFFSET_CUSTOM = "K"
CMD_DEF_OFFSET_TABLE = "L"
CMD_DEF_OFFSET_CUSTOM = "M"
CMD_SEL_OFFSET_TABLE = "N"
CMD_SEL_OFFSET_CUSTOM = "O"

CMD_AIR_ENABLE = "P"
CMD_AIR_DISABLE = "Q"
CMD_AUX1_ENABLE = "R"
CMD_AUX1_DISABLE = "S"
CMD_AUX2_ENABLE = "T"
CMD_AUX2_DISABLE = "U"


PARAM_TARGET_X = "x"
PARAM_TARGET_Y = "y" 
PARAM_TARGET_Z = "z" 
PARAM_FEEDRATE = "f"
PARAM_INTENSITY = "s"
PARAM_DURATION = "d"
PARAM_PIXEL_WIDTH = "p"

REQUEST_READY = '\x14'
################


################ RECEIVING PROTOCOL
# status: error flags
ERROR_SERIAL_STOP_REQUEST = '!'
ERROR_RX_BUFFER_OVERFLOW = '"'

ERROR_LIMIT_HIT_X1 = '$'
ERROR_LIMIT_HIT_X2 = '%'
ERROR_LIMIT_HIT_Y1 = '&'
ERROR_LIMIT_HIT_Y2 = '*'
ERROR_LIMIT_HIT_Z1 = '+'
ERROR_LIMIT_HIT_Z2 = '-'

ERROR_INVALID_MARKER = '#'
ERROR_INVALID_DATA = ':'
ERROR_INVALID_COMMAND = '<'
ERROR_INVALID_PARAMETER ='>'
ERROR_TRANSMISSION_ERROR ='='

# status: info flags
INFO_IDLE_YES = 'A'
INFO_IDLE_NO = 'B'
INFO_DOOR_OPEN = 'C'
INFO_DOOR_CLOSED = 'D'
INFO_CHILLER_OFF = 'E'
INFO_CHILLER_ON = 'F'
INFO_FEC_CORRECTION = 'G'

# status: info params
INFO_POS_X = 'x'
INFO_POS_Y = 'y'
INFO_POS_Z = 'z'
INFO_VERSION = 'v'

INFO_HELLO = '~'
READY = '\x12'

INFO_TARGET_X = 'a'
INFO_TARGET_Y = 'b'
INFO_TARGET_Z = 'c'
INFO_FEEDRATE = 'f'
INFO_INTENSITY = 's'
INFO_DURATION = 'd'
INFO_PIXEL_WIDTH = 'p'
################


SerialLoop = None

class SerialLoopClass(threading.Thread):

    def __init__(self):
        self.device = None

        self.tx_buffer = ""        
        self.remoteXON = True

        # TX_CHUNK_SIZE - this is the number of bytes to be 
        # written to the device in one go. It needs to match the device.
        self.TX_CHUNK_SIZE = 64
        self.RX_CHUNK_SIZE = 256
        self.nRequested = 0
        self.last_request_ready = 0
        
        # used for calculating percentage done
        self.job_size = 0

        # status flags
        self._status = {}
        self.reset_status()

        self.request_stop = False
        self.request_resume = False
        self.request_status = True  # cause an status request once connected

        self.pdata_count = 0
        self.pdata_chars = [None, None, None, None]

        threading.Thread.__init__(self)
        self.stop_processing = False

        # lock mechanism for chared data
        # see: http://effbot.org/zone/thread-synchronization.htm
        self.lock = threading.Lock()


    def reset_status(self):
        self._status = {
            'ready': False,  # when the machine is not busy
            'paused': False,

            'buffer_overflow': False,
            'serial_stop_request': False,
            'limit_x1': False,
            'limit_x2': False,
            'limit_y1': False,
            'limit_y2': False,
            'limit_z1': False,
            'limit_z2': False,
            'invalid_marker': False,
            'invalid_data': False,
            'invalid_command': False,
            'invalid_parameter': False,
            'transmission_error': False,

            'door_open': False,
            'chiller_off': False,

            'x': 0.0,
            'y': 0.0,
            'z': 0.0,
            'firmware_version': None,
            'x_target': 0.0,
            'y_target': 0.0,
            'z_target': 0.0,
            'feedrate': 0.0,
            'intensity': 0.0,
            'duration': 0.0,
            'pixel_width': 0.0

            # removed
            # limit_hit
            # 'bad_number_format_error': False,
            # 'expected_command_letter_error': False,
            # 'unsupported_statement_error': False,            
        }


    def print_status(self):
        symap = {False:'[ ]', True:'[x]' }
        keys = self._status.keys()
        keys.sort()
        for k in keys:
            if k not in ['x', 'y', 'z', 'firmware_version',
                         'x_target', 'y_target', 'z_target',
                         'feedrate', 'intensity', 'duration', 'pixel_width']:
                print symap[self._status[k]] + ' ' + k
        print  'x: ' + str(self._status['x'])
        print  'x: ' + str(self._status['y'])
        print  'x: ' + str(self._status['z'])
        print  'firmware_version: ' + str(self._status['firmware_version'])
        print  'x_target: ' + str(self._status['x_target'])
        print  'x_target: ' + str(self._status['y_target'])
        print  'x_target: ' + str(self._status['z_target'])
        print  'feedrate: ' + str(self._status['feedrate'])
        print  'intensity: ' + str(self._status['intensity'])
        print  'duration: ' + str(self._status['duration'])
        print  'pixel_width: ' + str(self._status['pixel_width'])


    def send_command(self, command):
        self.tx_buffer += command
        self.job_size += 1


    def send_param(self, param, val):
        # num to be [-134217.728, 134217.727]
        # three decimals are retained
        num = int(round((val*1000)+(2**27)))
        char0 = chr((num&127)+128)
        char1 = chr(((num&(127<<7))>>7)+128)
        char2 = chr(((num&(127<<14))>>14)+128)
        char3 = chr(((num&(127<<21))>>21)+128)
        self.tx_buffer += char0 + char1 + char2 + char3 + param
        self.job_size += 5



    def run(self):
        """Main loop of the serial thread."""
        while True:
            with self.lock:
                self._process()
            if self.stop_processing:
                break

    
    def _process(self):
        """Continuously call this to keep processing queue."""    
        if self.device and not self._status['paused']:
            try:
                ### receiving
                chars = self.device.read(self.RX_CHUNK_SIZE)
                if len(chars) > 0:
                    ## process chars
                    for char in chars:
                        # sys.stdout.write(char)
                        # sys.stdout.flush()
                        if ord(char) < 32:  ### flow
                            ## check for data request
                            if char == READY:
                                self.nRequested = self.TX_CHUNK_SIZE
                        elif ord(char) < 128:  ### markers
                            if 32 < ord(char) < 65: # stop error flags                            
                                # chr is in [!-@], process flag
                                if char == ERROR_SERIAL_STOP_REQUEST:
                                    self._status['serial_stop_request'] = True
                                elif char == ERROR_RX_BUFFER_OVERFLOW:
                                    self._status['buffer_overflow'] = True
                                elif char == ERROR_LIMIT_HIT_X1:
                                    self._status['limit_x1'] = True
                                elif char == ERROR_LIMIT_HIT_X2:
                                    self._status['limit_x2'] = True
                                elif char == ERROR_LIMIT_HIT_Y1:
                                    self._status['limit_y1'] = True
                                elif char == ERROR_LIMIT_HIT_Y2:
                                    self._status['limit_y2'] = True
                                elif char == ERROR_LIMIT_HIT_Z1:
                                    self._status['limit_z1'] = True
                                elif char == ERROR_LIMIT_HIT_Z2:
                                    self._status['limit_z2'] = True
                                elif char == ERROR_INVALID_MARKER:
                                    self._status['invalid_marker'] = True
                                elif char == ERROR_INVALID_DATA:
                                    self._status['invalid_data'] = True
                                elif char == ERROR_INVALID_COMMAND:
                                    self._status['invalid_command'] = True
                                elif char == ERROR_INVALID_PARAMETER:
                                    self._status['invalid_parameter'] = True
                                elif char == ERROR_TRANSMISSION_ERROR:
                                    self._status['transmission_error'] = True
                                # in stop mode
                                self.tx_buffer = ''
                                self.job_size = 0
                                # not ready whenever in stop mode
                                self._status['ready'] = False
                                self.print_status()

                            elif 64 < ord(char) < 91:  # info flags
                                # chr is in [A-Z], info flag
                                if char == INFO_FEC_CORRECTION:
                                    sys.stdout.write("\nFEC Correction!\n")
                                    sys.stdout.flush()                                              
                                    # self._status['fec_correction'] = True
                                elif char == INFO_IDLE_YES:
                                    self._status['ready'] = True
                                elif char == INFO_IDLE_NO:
                                    self._status['ready'] = False
                                elif char == INFO_DOOR_OPEN:
                                    self._status['door_open'] = True
                                elif char == INFO_DOOR_CLOSED:
                                    self._status['door_open'] = False
                                elif char == INFO_CHILLER_OFF:
                                    self._status['chiller_off'] = True
                                elif char == INFO_CHILLER_ON:
                                    self._status['chiller_off'] = False
                                else:
                                    print "ERROR: invalid flag"
                            elif 96 < ord(char) < 123:  # parameter
                                # char is in [a-z], process parameter
                                num = ((((ord(self.pdata_chars[3])-128)*2097152 
                                       + (ord(self.pdata_chars[2])-128)*16384 
                                       + (ord(self.pdata_chars[1])-128)*128 
                                       + (ord(self.pdata_chars[0])-128) )- 134217728)/1000.0)
                                if char == INFO_POS_X:
                                    self._status['x'] = num
                                elif char == INFO_POS_Y:
                                    self._status['y'] = num
                                elif char == INFO_POS_Z:
                                    self._status['z'] = num
                                elif char == INFO_VERSION:
                                    num = 'v' + str(int(num)/100.0)
                                    self._status['firmware_version'] = num
                                # debugging
                                elif char == INFO_TARGET_X:
                                    self._status['x_target'] = num
                                elif char == INFO_TARGET_Y:
                                    self._status['y_target'] = num
                                elif char == INFO_TARGET_Z:
                                    self._status['z_target'] = num
                                elif char == INFO_FEEDRATE:
                                    self._status['feedrate'] = num
                                elif char == INFO_INTENSITY:
                                    self._status['intensity'] = num
                                elif char == INFO_DURATION:
                                    self._status['duration'] = num
                                elif char == INFO_PIXEL_WIDTH:
                                    self._status['pixel_width'] = num
                                else:
                                    print "ERROR: invalid param"
                            elif char == INFO_HELLO:
                                print "Controller says Hello!"
                            else:
                                print ord(char)
                                print char
                                print "ERROR: invalid marker"
                            self.pdata_count = 0
                        else:  ### data
                            # char is in [128,255]
                            if self.pdata_count < 4:
                                self.pdata_chars[self.pdata_count] = char
                                self.pdata_count += 1
                            else:
                                print "ERROR: invalid data"                
                ### sending super commands (handled in serial rx interrupt)
                if self.request_status:
                    try:
                        self.device.write(CMD_STATUS)
                        self.device.flushOutput()
                        self.request_status = False
                    except serial.SerialTimeoutException:
                        sys.stdout.write("\nsending status request: writeTimeoutError\n")
                        sys.stdout.flush()
                if self.request_stop:
                    try:
                        self.device.write(CMD_STOP)
                        self.device.flushOutput()
                        self.request_stop = False
                    except serial.SerialTimeoutException:
                        sys.stdout.write("\nsending stop request: writeTimeoutError\n")
                        sys.stdout.flush()
                if self.request_resume:
                    try:
                        self.device.write(CMD_RESUME)
                        self.device.flushOutput()
                        self.request_resume = False
                        # update status
                        self.reset_status()
                        self.request_status = True
                    except serial.SerialTimeoutException:
                        sys.stdout.write("\nsending resume request: writeTimeoutError\n")
                        sys.stdout.flush()
                ### sending from buffer
                if self.tx_buffer:
                    if self.nRequested > 0:
                        try:
                            actuallySent = self.device.write(self.tx_buffer[:self.nRequested])
                        except serial.SerialTimeoutException:
                            # skip, report
                            actuallySent = self.nRequested  # pyserial does not report this sufficiently
                            sys.stdout.write("\n_process: writeTimeoutError\n")
                            sys.stdout.flush()
                        # sys.stdout.write(self.tx_buffer[:actuallySent])  # print w/ newline
                        self.tx_buffer = self.tx_buffer[actuallySent:]
                        self.nRequested -= actuallySent
                        if self.nRequested <= 0:
                            self.last_request_ready = 0  # make sure to request ready
                    else:
                        if (time.time()-self.last_request_ready) > 2.0:
                            # ask to send a ready byte
                            # only ask for this when sending is on hold
                            # only ask once (and after a big time out)
                            # print "=========================== REQUEST READY"
                            try:
                                actuallySent = self.device.write(REQUEST_READY)
                            except serial.SerialTimeoutException:
                                # skip, report
                                actuallySent = self.nRequested  # pyserial does not report this sufficiently
                                sys.stdout.write("\n_process: writeTimeoutError, on ready request\n")
                                sys.stdout.flush()
                            if actuallySent == 1:
                                self.last_request_ready = time.time()
                         
                else:
                    if self.job_size:
                        # print "\nstream finished!"
                        # print "(firmware may take some extra time to finalize)"
                        self.job_size = 0
            except OSError:
                # Serial port appears closed => reset
                self.close()
            except ValueError:
                # Serial port appears closed => reset
                self.close()     
        else:
            # serial disconnected    
            self._status['ready'] = False






###########################################################################
### API ###################################################################
###########################################################################

            
def find_controller(baudrate=conf['baudrate']):
    if os.name == 'posix':
        iterator = sorted(serial.tools.list_ports.grep('tty'))
        for port, desc, hwid in iterator:
            print "Looking for controller on port: " + port
            try:
                s = serial.Serial(port=port, baudrate=baudrate, timeout=2.0)
                lasaur_hello = s.read(8)
                if lasaur_hello.find(INFO_HELLO) > -1:
                    return port
                s.close()
            except serial.SerialException:
                pass
    else:
        # windows hack because pyserial does not enumerate USB-style com ports
        print "Trying to find controller ..."
        for i in range(24):
            try:
                s = serial.Serial(port=i, baudrate=baudrate, timeout=2.0)
                lasaur_hello = s.read(8)
                if lasaur_hello.find(INFO_HELLO) > -1:
                    return s.portstr
                s.close()
            except serial.SerialException:
                pass      
    print "ERROR: No controller found."
    return None

    

def connect(port=conf['serial_port'], baudrate=conf['baudrate']):
    global SerialLoop
    if not SerialLoop:
        SerialLoop = SerialLoopClass()

        # Create serial device with both read timeout set to 0.
        # This results in the read() being non-blocking
        # Write on the other hand uses a large timeout but should not be blocking
        # much because we ask it only to write TX_CHUNK_SIZE at a time.
        # BUG WARNING: the pyserial write function does not report how
        # many bytes were actually written if this is different from requested.
        # Work around: use a big enough timeout and a small enough chunk size.
        try:
            SerialLoop.device = serial.Serial(port, baudrate, timeout=0, writeTimeout=0.1)
            # clear throat
            time.sleep(1.0) # allow some time to receive a prompt/welcome
            SerialLoop.device.flushInput()
            SerialLoop.device.flushOutput()

            SerialLoop.start()  # this calls run() in a thread
        except serial.SerialException:
            SerialLoop = None
            print "ERROR: Cannot connect serial on port: %s" % (port)
    else:
        print "ERROR: disconnect first"



def connected():
    global SerialLoop
    return SerialLoop and bool(SerialLoop.device)


def close():
    global SerialLoop
    if SerialLoop:
        if SerialLoop.device:
            SerialLoop.device.flushOutput()
            SerialLoop.device.flushInput()
            ret = True
        else:
            ret = False
        if SerialLoop.is_alive():
            SerialLoop.stop_processing = True
            SerialLoop.join()
    else:
        ret = False
    SerialLoop = None
    return ret



def flash(serial_port=conf['serial_port'], firmware_file=conf['firmware']):
    import flash
    reconnect = False
    if connected():
        close()
        reconnect = True
    ret = flash.flash_upload(serial_port=serial_port, firmware_file=firmware_file)
    if reconnect:
        connect()
    if ret != 0:
        print "ERROR: flash failed"
    return ret


def build(firmware_name="LasaurGrbl"):
    import build
    ret = build.build_firmware(firmware_name=firmware_name)
    if ret != 0:
        print "ERROR: build failed"
    return ret


def reset():
    import flash
    flash.reset_atmega()
    return '1'


def percentage():
    """Return the percentage done as an integer between 0-100.
    Return -1 if no job is active."""
    global SerialLoop
    ret = -1
    with SerialLoop.lock:
        if SerialLoop.job_size != 0:
            ret = int(100-100*len(SerialLoop.tx_buffer)/float(SerialLoop.job_size))
    return ret


def status():
    """Request status."""
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.request_status = True
        SerialLoop.print_status()


def homing():
    """Run homing cycle."""
    global SerialLoop
    with SerialLoop.lock:
        if SerialLoop._status['ready']:
            SerialLoop.send_command(CMD_HOMING)
        else:
            print "WARN: ignoring homing command while job running"



def feedrate(val):
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_param(PARAM_FEEDRATE, val)

def intensity(val):
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_param(PARAM_INTENSITY, val)

def move(x, y, z=0.0):
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_param(PARAM_TARGET_X, x)
        SerialLoop.send_param(PARAM_TARGET_Y, y)
        SerialLoop.send_param(PARAM_TARGET_Z, z)
        SerialLoop.send_command(CMD_LINE)




def job(jobdict):
    """Queue a job.
    A job dictionary can define vector and raster passes.
    Unlike gcode it's not procedural but declarative.
    The job dict looks like this:
    ###########################################################################
    {
        "vector":                          # optional
        {
            "passes":
            [
                {
                    "paths": [0],          # paths by index
                    "relative": True,      # optional, default: False
                    "seekrate": 6000,      # optional, rate to first vertex
                    "feedrate": 2000,      # optional, rate to other verteces
                    "intensity": 100,      # optional, default: 0 (in percent)
                    "pierce_time": 0,      # optional, default: 0
                    "air_assist": "feed",   # optional (feed, pass, off), default: feed
                    "aux1_assist": "off",  # optional (feed, pass, off), default: off
                }
            ],
            "paths":
            [                              # list of paths
                [                          # list of polylines
                    [                      # list of verteces
                        [0,-10],           # list of coords
                    ],
                ],
            ],
            "colors": ["#FF0000"],
        }
        "raster":                          # optional
        {
            "passes":
            [
                {
                    "image": [0]
                    "seekrate": 6000,      # optional
                    "feedrate": 3000,
                    "intensity": 100,
                },
            ]
            "images":
            [
                <rasterdata>,               # image data in base64
            ]
        }
    }
    ###########################################################################
    """

    ### rasters
    # if jobdict.has_key('rasterpass') and jobdict.has_key('rasters'):
    #     rseekrate = jobdict['rasterpass']['seekrate']
    #     rfeedrate = jobdict['rasterpass']['feedrate']
    #     rintensity = jobdict['rasterpass']['intensity']
    #     # TODO: queue raster

    ### vectors
    if jobdict.has_key('vector'):
        if jobdict['vector'].has_key('passes') and jobdict['vector'].has_key('paths'):
            passes = jobdict['vector']['passes']
            paths = jobdict['vector']['paths']
            for pass_ in passes:
                # turn on assists if set to 'pass'
                if 'air_assist' in pass_ and pass_['air_assist'] == 'pass':
                    air_on()
                if 'aux1_assist' in pass_ and pass_['aux1_assist'] == 'pass':
                    aux1_on()
                for path_index in pass_['paths']:
                    if path_index < len(paths):
                        path = paths[path_index]
                        for polyline in path:
                            if len(polyline) > 0:
                                # first vertex -> seek
                                if 'seekrate' in pass_:
                                    feedrate(pass_['seekrate'])
                                else:
                                    feedrate(conf['seekrate'])
                                intensity(0.0)
                                is_2d = len(polyline[0]) == 2
                                if is_2d:
                                    move(polyline[0][0], polyline[0][1])
                                else:
                                    move(polyline[0][0], polyline[0][1], polyline[0][2])
                                # remaining verteces -> feed
                                if len(polyline) > 1:
                                    if 'feedrate' in pass_:
                                        feedrate(pass_['feedrate'])
                                    else:
                                        feedrate(conf['feedrate'])
                                    if 'intensity' in pass_:
                                        intensity(pass_['intensity'])
                                    # turn on assists if set to 'feed'
                                    # also air_assist defaults to 'feed'                 
                                    if 'air_assist' in pass_:
                                        if pass_['air_assist'] == 'feed':
                                            air_on()
                                    else:
                                        air_on()  # also default this behavior
                                    if 'aux1_assist' in pass_ and pass_['aux1_assist'] == 'feed':
                                        aux1_on()
                                    # TODO dwell according to pierce time
                                    if is_2d:
                                        for i in xrange(1, len(polyline)):
                                            move(polyline[i][0], polyline[i][1])
                                    else:
                                        for i in xrange(1, len(polyline)):
                                            move(polyline[i][0], polyline[i][1], polyline[i][2])
                                    # turn off assists if set to 'feed'
                                    # also air_assist defaults to 'feed'                 
                                    if 'air_assist' in pass_:
                                        if pass_['air_assist'] == 'feed':
                                            air_off()
                                    else:
                                        air_off()  # also default this behavior        
                                    if 'aux1_assist' in pass_ and pass_['aux1_assist'] == 'feed':
                                        aux1_off()
                # turn off assists if set to 'pass'
                if 'air_assist' in pass_ and pass_['air_assist'] == 'pass':
                    air_off()
                if 'aux1_assist' in pass_ and pass_['aux1_assist'] == 'pass':
                    aux1_off()



def pause():
    global SerialLoop
    with SerialLoop.lock:
        if len(SerialLoop.tx_buffer) == 0:
            ret = False
        else:
            SerialLoop._status['paused'] = True
            ret = True
    return ret

def unpause(flag):
    global SerialLoop
    with SerialLoop.lock:
        if len(SerialLoop.tx_buffer) == 0:
            ret = False
        else:
            SerialLoop._status['paused'] = False
            ret = False
    return ret


def stop():
    """Force stop condition."""
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.tx_buffer = ''
        SerialLoop.job_size = 0
        # SerialLoop.reset_status()
        SerialLoop.request_stop = True


def unstop():
    """Resume from stop condition."""
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.request_resume = True


def air_on():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_AIR_ENABLE)

def air_off():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_AIR_DISABLE)


def aux1_on():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_AUX1_ENABLE)

def aux1_off():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_AUX1_DISABLE)


def aux2_on():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_AUX2_ENABLE)

def aux2_off():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_AUX2_DISABLE)


def set_offset_table():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_SET_OFFSET_TABLE)

def set_offset_custom():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_SET_OFFSET_CUSTOM)

def def_offset_table(x, y, z):
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_param(PARAM_TARGET_X, x)
        SerialLoop.send_param(PARAM_TARGET_Y, y)
        SerialLoop.send_param(PARAM_TARGET_Z, z)
        SerialLoop.send_command(CMD_DEF_OFFSET_TABLE)

def def_offset_custom(x, y, z):
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_param(PARAM_TARGET_X, x)
        SerialLoop.send_param(PARAM_TARGET_Y, y)
        SerialLoop.send_param(PARAM_TARGET_Z, z)
        SerialLoop.send_command(CMD_DEF_OFFSET_CUSTOM)

def sel_offset_table():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_SEL_OFFSET_TABLE)

def sel_offset_custom():
    global SerialLoop
    with SerialLoop.lock:
        SerialLoop.send_command(CMD_SEL_OFFSET_CUSTOM)



def testjob():
    j = json.load(open(os.path.join(conf['rootdir'], 'library', 'Lasersaur.lsa')))
    job(j)