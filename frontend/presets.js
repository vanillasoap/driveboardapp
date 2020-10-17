
var presets = []

function presets_clear() {
    $('#presets_content').html("")
}

function presets_ready() {
    presets_update()
    // Make the name input field active when the modal is shown
    $('#presets_modal').on('shown.bs.modal', function() {
        $('#preset_name').focus()
    })
}

function save_preset() {
    var name = $('#preset_name').val()
    var feedrate = parseInt($('#preset_feedrate').val())
    var intensity = parseInt($('#preset_intensity').val())
    var pxsize = parseFloat($('#preset_pxsize').val())
    if (!isNaN(feedrate) && !isNaN(intensity) & !isNaN(pxsize) & name.length > 0 && feedrate + intensity > 0) {
        request_get({
            url: `/save_preset/${name}/${feedrate}/${intensity}/${pxsize}`
        })
        $('#presets_modal').modal('toggle')
        presets_update()
    }
    return false
}

function presets_update() {
    request_get({
        url: '/listing_presets',
        success: function(data) {
            presets = data
            var html = `
            <table class="table table-borderless table-sm">
                <tbody>
                <tr>
                  <td>
                    <input id="preset_name" type="text" class="form-control form-control-sm" value="" title="preset name" placeholder= "name">
                  </td>
                  <td>
                    <input id="preset_feedrate" type="text" class="form-control form-control-sm" style="width:7rem; margin-left:auto;" value="" title="preset feedrate" placeholder="feedrate">
                  </td>
                  <td>
                    <input id="preset_intensity" type="text" class="form-control form-control-sm" style="width:5rem; margin-left:auto;" value="" title="preset intensity" placeholder="intensity">
                  </td>
                  <td>
                    <input id="preset_pxsize" type="text" class="form-control form-control-sm" style="width:5rem; margin-left:auto;" value="" title="pixel size" placeholder="pxsize">
                  </td>
                  <td style="text-align:right;">
                    <button id="preset_ok" type="button" class="btn btn-secondary-light" role="button">
                      <i class="fas fa-plus"></i>
                    </button>
                  </td>
                </tr>
              `
            for (var i = 0; i < data.length; i++) {
                html += `
                <tr>
                  <td class="preset-name">${data[i].name}</td>
                  <td style="text-align:right;">${data[i].feedrate}</td>
                  <td style="text-align:right;">${data[i].intensity}%</td>
                  <td style="text-align:right;">${data[i].pxsize}%</td>
                  <td style="text-align:right;">
                    <button id="del_preset_btn_${i}" class="btn btn-secondary-light btn-del-preset" style="margin-left:8px; position:relative; top:1px" role="button">
                      <i class="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
                `
            }
            html += '</tbody></table>'
            $('#presets_content').html(html)

            // save actions
            $('#preset_ok').click(save_preset)
            $('#preset_name').keyup(function(e) {
                if (e.which == 13) {
                    save_preset()
                    return false
                }
                return true
            })

            // delete action
            $('.btn-del-preset').click(function(e) {
                var name = $(this).parent().parent().find('td.preset-name').text()
                request_get({
                    url: `/save_preset/${name}/0/0`,
                    success: function() {
                        presets_update()
                    }
                })
            })

            // update existing presets menus, if any
            passes_update_presets()
        }
    })
}