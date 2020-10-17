// Webkit polyfill
//
if (!Object.entries) {
  NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
  Object.entries = function( obj ){
    var ownProps = Object.keys( obj ),
        i = ownProps.length,
        resArray = new Array(i); // preallocate the Array
    while (i--)
      resArray[i] = [ownProps[i], obj[ownProps[i]]];

    return resArray;
  };
}

var TORUS;

(function() {
  TORUS = TORUS || {};

  /**
   * Background Image
   */
  TORUS.backgroundImage = function(selector) {
    Array.from(document.querySelectorAll(selector), function(element) {
      let image = element.querySelector(".bg-img");
      if (image) {
        element.style.setProperty("background-image", "url(" + image.getAttribute("src") + ")");
      }
    });
  };
  TORUS.backgroundImage(".has-bg-img, .has-bg-pattern");

  /**
   * Chrome range progress
   */
  TORUS.webkitRangeProgress = function(selector) {
    let range;
    let countRange = function(element) {
      let min = element.min || 0;
      let max = element.max || 100;
      range = ((element.value - min) / (max - min)) * 100;
      element.style.setProperty("--range", range + "%");
    }

    Array.from(document.querySelectorAll(selector), function(element) {
      countRange(element);
      element.addEventListener("input", function(e) {
        countRange(e.target);
      }, false);
    });
  };
  TORUS.webkitRangeProgress(".custom-range-progress");

  /**
   * Add class after scroll
   */
  TORUS.scrollAction = function(selector) {
    "use strict";

    let scrolledTop;
    let scrolled = false;
    let classToAdd, classToRemove;

    this.scrollActions = function() {
      scrolledTop = window.pageYOffset || document.documentElement.scrollTop;

      if(scrolledTop > 0 && scrolled === false) {
        for(const el of document.querySelectorAll(selector) ) {
          for(const actions of el.getAttribute("data-scroll-action").replace(/ +/g," ").replace("] ", "]__").split("__") ) {
            let GP = getProperties(actions);
            if(GP.name === "add") {
              classToAdd = GP.value;
            }
            if(GP.name === "remove") {
              classToRemove = GP.value;
            }
          }
          el.classList.add(...classToAdd.split(" "));
          el.classList.remove(...classToRemove.split(" "));
        }
        scrolled = true;
      }
      if(scrolledTop === 0) {
        for(const el of Array.from(document.querySelectorAll(selector)) ) {
          el.classList.remove(...classToAdd.split(" "));
          el.classList.add(...classToRemove.split(" "));
        }
        scrolled = false;
      }

    }
    window.addEventListener("scroll", this.scrollActions, {passive: true});
  }
  TORUS.scrollAction("[data-scroll-action]");

  /**
   * Custom number input counter
   */
  (function() {
    Array.from(document.querySelectorAll(".btn-custom-number-up"), element => {
      element.addEventListener("click", () => {
        const input = document.querySelector(element.getAttribute("target"));
        input.stepUp();
      })
    });

    Array.from(document.querySelectorAll(".btn-custom-number-down"), element => {
      element.addEventListener("click", () => {
        const input = document.querySelector(element.getAttribute("target"));
        input.stepDown();
      })
    });
  }());

  /**
   * Effects [data-fx]
   */
  let TorusFx = function(el, property) {
    "use strict";

    let self = this;
    let timeout;
    let scrolledTop   = window.pageYOffset || document.documentElement.scrollTop;
    let scrolledLeft  = window.pageXOffset || document.documentElement.scrollLeft;
    let windowHeight  = window.innerHeight || document.documentElement.clientHeight;
    let windowWidth   = window.innerWidth  || document.documentElement.clientWidth;
    let mouseX, mouseY;
    let tiltHoverEl = false;
    let sensorEnabled;
    let sensorBeta = 0, sensorGamma = 0;
    let cssVars = {
      active_bg: "bg-active",
      active_border: "border-active",
      active_fill: "fill-color",
      active_text: "text-active",
      block: "block-color",
      delay: "d",
      duration: "tr-duration",
      pull: "translate-dist",
      push: "translate-dist",
      grow: "scale-final",
      shrink: "scale-final",
      speed: "tr-speed",
      wait: "wait"
    }

    self.inviewElements = [];
    self.parallaxElements = [];
    self.customTransformElements = [];

    self.addDataFx = function() {
      // No [data-fx] or properties to set
      //
      if(!self.property && !self.el.hasAttribute("data-fx")) {
        console.warn(self.el, "No [data-fx] or property");
      }
      // With property
      //
      else if(self.property){
        self.addDataFxFromProperty(self.el, self.property);
      }
      // Element has [data-fx] already
      //
      else {
        self.findAndSetCustomProperties(self.el);
      }
    }

    // Transfer property into [data-fx]
    //
    self.addDataFxFromProperty = function() {
      self.el.setAttribute("data-fx", self.property);
      self.findAndSetCustomProperties();
    }

    // Find custom properties with []
    //
    self.findAndSetCustomProperties = function() {
      let properties = {};
      // self.el.dataset.fx = removeSpaces(self.el.dataset.fx.replace(/ +/g, " ").replace(" .. ", " ").replace(/ $/g, ""), "\\[ | \\]|{ | }| : |: | :| ; |; | ;");
      // self.el.dataset.fx = removeSpaces(self.el.dataset.fx.replace(/ +/g, " ").replace(" .. ", " ").replace(/ $/g, ""), "\\[ | \\]|{ | }| { | : |: | :| ; |; | ;| ,|, | , ");

      self.el.setAttribute("data-fx", removeSpaces(self.el.getAttribute("data-fx").replace(/ +/g, " ").replace(" .. ", " ").replace(/ $/g, ""), "\\[ | \\]|{ | }| { | : |: | :| ; |; | ;| ,|, | , ") );

      for(const propertyString of self.el.getAttribute("data-fx").split(" ")) {
        let propertyKey, propertyValue;
        let GP = getProperties(propertyString);

        propertyKey   = GP.activeName;
        propertyValue = GP.value;

        properties[propertyKey] = propertyValue;
      }

      self.el._fx = properties;
      self.assignCssVariable();
    }

    // Assign corresponding CSS variable
    //
    self.assignCssVariable = function() {
      for( let [fxKey, fxValue] of Object.entries(self.el._fx) ) {
        for( let [cssVarsKey, cssVarsName] of Object.entries(cssVars) ) {
          if( fxKey === cssVarsKey ) {
            self.el.style.setProperty(`--${cssVarsName}`, fxValue);
          }
        }
      }
    }

    //
    // ------------------------------------------------------------------------
    // INVIEW
    // ------------------------------------------------------------------------
    //
    // INVIEW: Add .inview class if in viewport
    //
    self.inviewAddClass = function(){
      for(const el of self.inviewElements) {
        if( self.inviewCheck(el) ) {
          console.log("is");
          el.classList.add("inview");
        }
        else if( typeof el._fx !== "undefined" && el._fx.inviewReset === "true" ) {
          el.classList.remove("inview");
        }
      }
    }

    // INVIEW Check if element is in viewport
    //
    self.inviewCheck = function(el){
      let bounds = el.getBoundingClientRect();
      let screenHeight = (window.innerHeight || document.documentElement.clientHeight);
      let screenWidth = (window.innerWidth || document.documentElement.clientWidth);

      return ( bounds.top < screenHeight && bounds.bottom > 0 && bounds.left < screenWidth && bounds.right > 0 );
    }

    // INVIEW requestAnimationFrame
    //
    self.inviewListenerRAF = function(){
      timeout && window.cancelAnimationFrame(timeout);
      timeout = window.requestAnimationFrame(function(){
        self.inviewAddClass();
      });
    }

    // INVIEW Init
    //
    self.inviewInit = function(){
      self.inviewAddClass();
      window.addEventListener("scroll", self.inviewListenerRAF, false);
    }

    //
    // ------------------------------------------------------------------------
    // PARALLAX
    // ------------------------------------------------------------------------
    //
    self.runParallax = function(){
      let requestAF;

      self.runScrollParallax = function() {
        for(const el of self.scrollParallaxElements) {
          // scrollParallaxY = scrollParallaxY = ((el._fx.offsetTop - scrolledTop) - ((windowHeight/2) - (el.clientHeight/2))) * (scrollParallaxValue) * 0.01;
          // scrollParallaxY = el._fx.scrollParallaxCenter ? scrollParallaxY = ((el._fx.offsetTop - scrolledTop) - ((windowHeight/2) - (el.clientHeight/2))) * (scrollParallaxValue) * 0.01 : scrollParallaxY = - scrolledTop;
          el._fx.scrollParallaxY += (-scrolledTop - el._fx.scrollParallaxY)/el._fx.scrollParallaxEase;
          el.style.setProperty(`--scroll-parallaxY`, `${ calculateTransform(el._fx.scrollParallaxY, el._fx.scrollParallax || 1, 0.01) }px`);
        }
      }

      self.runMouseParallax = function() {
        if( mouseX >= 0 || mouseY >= 0 ) {
          for(const el of self.mouseParallaxElements) {
            el._fx.mouseParallaxElementX += ((mouseX - (windowWidth/2)) - el._fx.mouseParallaxElementX)/el._fx.mouseParallaxEase;
            el._fx.mouseParallaxElementY += ((mouseY - (windowHeight/2)) - el._fx.mouseParallaxElementY)/el._fx.mouseParallaxEase;
            el.style.setProperty(`--mouse-parallaxX`, `${ calculateTransform(el._fx.mouseParallaxElementX, el._fx.mouseParallaxX || el._fx.mouseParallax || 1, 0.00125) }px`);
            el.style.setProperty(`--mouse-parallaxY`, `${ calculateTransform(el._fx.mouseParallaxElementY, el._fx.mouseParallaxY || el._fx.mouseParallax || 1, 0.00125) }px`);
          }
        }
      }

      self.runTilt = function() {
        if( mouseX >= 0 || mouseY >= 0 ) {
          if( tiltHoverEl ) {
            let el = tiltHoverEl;
            el._fx.hoverTiltXDeg = !!(mouseY-el._fx.top) && ( ((mouseY-el._fx.top) - el.clientHeight/2))*(el.clientHeight/100);
            el._fx.hoverTiltYDeg = !!(mouseX-el._fx.left) && ( ((mouseX-el._fx.left) - el.clientWidth/2 ))*(el.clientWidth/100);
            el.style.setProperty(`--tiltX`, `${ calculateTransform( -el._fx.hoverTiltXDeg, el._fx.hoverTiltX || el._fx.hoverTilt || 20, 0.00125) }deg`);
            el.style.setProperty(`--tiltY`, `${ calculateTransform(  el._fx.hoverTiltYDeg, el._fx.hoverTiltX || el._fx.hoverTilt || 20, 0.00125) }deg`);
          }
          // Mouse Move Tilt
          //
          for(const el of self.mouseTiltElements) {
            if(!("hoverTilt" in el._fx)) {
              el._fx.tiltXDeg = (mouseY + (windowHeight/2)) - (windowHeight/2) - (el._fx.top + el.clientHeight/2);
              el._fx.tiltYDeg = (mouseX + (windowWidth/2))  - (windowWidth/2)  - (el._fx.offsetLeft + el.clientWidth/2);
              el._fx.tiltZDeg = (( (mouseX - (el._fx.offsetLeft + el.clientWidth/2)) * (mouseY - (el._fx.top + el.clientHeight/2))))/3000;
              el.style.setProperty(`--tiltX`, `${ calculateTransform(-el._fx.tiltXDeg, el._fx.tiltX || el._fx.tilt || 20, 0.00125) }deg`);
              el.style.setProperty(`--tiltY`, `${ calculateTransform( el._fx.tiltYDeg, el._fx.tiltY || el._fx.tilt || 20, 0.00125) }deg`);
              el.style.setProperty(`--tiltZ`, `${ calculateTransform( el._fx.tiltZDeg, el._fx.tiltZ || el._fx.tilt || 20, 0.00125) }deg`);
            }
          }
        }
      }

      self.runSensorParallax = function(){
        for(const el of self.sensorParallaxElements) {
          el._fx.sensorParallaxElementX = Math.round(sensorGamma*100)/100;
          el._fx.sensorParallaxElementY = Math.round(sensorBeta*100)/100;
          el.style.setProperty(`--sensor-parallaxX`, `${ calculateTransform(el._fx.sensorParallaxElementX, el._fx.sensorParallax || 1, 0.01) }px`);
          el.style.setProperty(`--sensor-parallaxY`, `${ calculateTransform(el._fx.sensorParallaxElementY, el._fx.sensorParallax || 1, 0.01) }px`);
        }
      }

      // RequestAnimationFrame
      //
      self.RAF = function() {
        // Scroll Parallax
        //
        self.runScrollParallax();
        // Mouse Move Parallax
        //
        self.runMouseParallax();
        // Sensor Parallax
        //
        if(sensorEnabled)
        self.runSensorParallax();

        requestAF = window.requestAnimationFrame(self.RAF);
      }
      self.RAF();
    }
    // end runParallax()

    // PARALLAX init
    //
    self.parallaxInit = function() {

      self.scrollParallaxElements = [];
      self.mouseParallaxElements = [];
      self.mouseTiltElements = [];
      self.sensorParallaxElements = [];

      self.runParallax();

      // 'ontouchstart' in document.documentElement && document.querySelector("body").classList.add("has-touch");

      for(const el of self.parallaxElements) {
        // el._fx.top = Math.round(el.getBoundingClientRect().top);
        // el._fx.left = Math.round(el.getBoundingClientRect().left);
        // el._fx.offsetTop = Math.round(el.getBoundingClientRect().top) + (window.pageYOffset || document.documentElement.scrollTop);
        // el._fx.offsetLeft = Math.round(el.getBoundingClientRect().left) + (window.pageXOffset || document.documentElement.scrollLeft);

        /* el._fx.scrollParallaxY = el._fx.scrollParallaxY || 0;
        el._fx.scrollParallaxEase = el._fx.scrollParallaxEase || 1;
        el._fx.mouseParallaxElementX = el._fx.mouseParallaxElementX || 0;
        el._fx.mouseParallaxElementY = el._fx.mouseParallaxElementY || 0;
        el._fx.mouseParallaxEase = el._fx.mouseParallaxEase || 1;
        el._fx.sensorParallaxElementX = el._fx.sensorParallaxElementX || 0;
        el._fx.sensorParallaxElementY = el._fx.sensorParallaxElementY || 0;
        el._fx.hoverTiltXDeg = el._fx.hoverTiltXDeg || 0;
        el._fx.hoverTiltYDeg = el._fx.hoverTiltYDeg || 0;
        el._fx.tiltXDeg = el._fx.tiltXDeg || 0;
        el._fx.tiltYDeg = el._fx.tiltYDeg || 0;
        el._fx.tiltZDeg = el._fx.tiltZDeg || 0; */

        self.setBounds(el);

        if( el.getAttribute("data-fx").indexOf("scroll-parallax") >= 0 ) {
          self.scrollParallaxElements.push(el);
        }

        if( el.getAttribute("data-fx").indexOf("mouse-parallax") >= 0 ) {
          self.mouseParallaxElements.push(el);
        }

        if( el.getAttribute("data-fx").indexOf("sensor-parallax") >= 0 ) {
          self.sensorParallaxElements.push(el);
        }

        if( el.getAttribute("data-fx").indexOf("tilt") >= 0 ) {
          self.mouseTiltElements.push(el);
          if("hoverTilt" in el._fx) {
            el.addEventListener("mouseenter", self.onMouseEnter);
            el.addEventListener("mouseleave", self.onMouseLeave);
          }
        }
      }

      if( self.scrollParallaxElements.length > 0 ){
        // window.addEventListener("scroll", self.onScroll, {passive: true});
        self.initEventListeners({initScrollEvent: true});
      }
      if( self.mouseParallaxElements.length > 0 || self.mouseTiltElements.length > 0 ){
        // window.addEventListener("mousemove", self.onMouseMove, {passive: true});
        self.initEventListeners({initMouseEvent: true});
      }
      if( self.sensorParallaxElements.length > 0 ){
        self.initEventListeners({initSensorEvent: true});
        // window.addEventListener("deviceorientation", self.onSensor, {passive: true});
      }
    }

    //
    // ------------------------------------------------------------------------
    // CUSTOM TRANSFORM
    // ------------------------------------------------------------------------
    //

    self.CT_mouse_elements   = [];
    self.CT_mouseX_elements  = [];
    self.CT_mouseY_elements  = [];
    self.CT_scroll_elements  = [];
    self.CT_sensor_elements  = [];
    self.CT_sensorX_elements = [];
    self.CT_sensorY_elements = [];
    self.CT_hover_elements = [];

    self.CT_mouse_elements_length;
    self.CT_mouseX_elements_length;
    self.CT_mouseY_elements_length;

    let CT_onmouse_event      = new Event("onmouseEvent");
    let CT_onscroll_event     = new Event("onscrollEvent");
    let CT_onmouseenter_event = new Event("onmouseenterEvent");

    // let CT_mouse_event  = new Event("onmouseEvent");
    // let CT_mouseX_event = new Event("onmouseXEvent");
    // let CT_mouseY_event = new Event("onmouseYEvent");

    // self.calcMouse = function(origin, el, mouseDirection) {
    //   let mouse;
    //   if(mouseDirection === "m"){
    //     mouse = (origin === "self") ? (self.getMouseHoverPosition(el, el._fx.centerX, el._fx.centerY)) : (origin) ? (mousePercents[origin].m) : (mousePercents.middle.m);
    //   }
    //   if(mouseDirection === "mx"){
    //     mouse = (origin === "self") ? (1 - Math.abs((mouseX-el._fx.centerX)/el._fx.maxXSide)) : (origin === "self_negative") ? 1 + ((mouseX-el._fx.centerX)/el._fx.maxXSide) : (origin === "parallax") ? ((mouseX-(el._fx.centerX))/windowWidth) : (origin) ? (mousePercents[origin].mx) : (mousePercents.middle.mx);
    //     // console.log(mouse);
    //   }
    //   if(mouseDirection === "my"){
    //     mouse = (origin === "self") ? (1 - Math.abs((mouseY-el._fx.centerY)/el._fx.maxYSide)) : (origin === "self_negative") ? 1 + ((mouseY-el._fx.centerY)/el._fx.maxYSide) : (origin === "parallax") ? ((mouseY-(el._fx.centerY))/windowHeight) : (origin) ? (mousePercents[origin].my) : (mousePercents.middle.my);
    //   }
    //   return mouse;
    // }

    self.mousePercents = function(el){
      // if(mouseX >= 0 || mouseY >= 0){
        return {
          "middle": {
            mx: Math.round(( 1 - Math.abs((windowWidth/2-mouseX)  / (windowWidth/2))) * 1000) / 1000,
            my: Math.round(( 1 - Math.abs((windowHeight/2-mouseY) / (windowHeight/2))) * 1000) / 1000,
            m:  Math.round(( 1 - Math.sqrt(Math.pow(windowWidth/2-mouseX,2) + Math.pow(windowHeight/2-mouseY,2)) / Math.sqrt(Math.pow(windowWidth/2,2) + Math.pow(windowHeight/2,2))) * 1000) / 1000,
          },
          "start": {
            mx: Math.round(( 1 - (windowWidth-mouseX) / (windowWidth)) * 1000) / 1000,
            my: Math.round(( 1 - (windowHeight-mouseY) / (windowHeight)) * 1000) / 1000,
            m:  Math.sqrt(Math.pow(mouseX,2) + Math.pow(mouseY,2)) / Math.sqrt(Math.pow(windowWidth,2) + Math.pow(windowHeight,2))
          },
          "negative": {
            mx: Math.round(( 1 - (windowWidth/2-mouseX)  / (windowWidth/2)) * 1000) / 1000,
            my: Math.round(( 1 - (windowHeight/2-mouseY) / (windowHeight/2)) * 1000) / 1000,
          },
          "self": {
            mx: el && 1 - Math.abs((mouseX-el._fx.centerX)/el._fx.maxXSide),
            my: el && 1 - Math.abs((mouseY-el._fx.centerY)/el._fx.maxYSide),
            m:  el && (self.getMouseHoverPosition(el, el._fx.centerX, el._fx.centerY))
          },
          "self-negative": {
            mx: el && 1 + ((mouseX-el._fx.centerX)/el._fx.maxXSide),
            my: el && 1 + ((mouseY-el._fx.centerY)/el._fx.maxYSide),
            // m:  el && (self.getMouseHoverPosition(el, el._fx.centerX/el._fx.maxXSide, el._fx.centerY/el._fx.maxYSide))
            m:  el && (self.getMouseHoverPosition(el, el._fx.centerX, el._fx.centerY))
          },
          "parallax": {
            mx: ((mouseX-windowWidth/2) / (windowWidth/2)),
            my: ((mouseY-windowHeight/2) / (windowHeight/2))
          }
        }
      // }
    }

    self.scrollPercents = function(el, offset) {
      return {
        regular: {
          sy: el && (windowHeight - (el._fx.offsetTop - scrolledTop + (parseInt(offset) === 50 ? el._fx.height/2 : 0) )) / ( ((windowHeight)/100) * parseInt(offset) )
        },
        parallax: {
          sy: el && 1- ( windowHeight/2 - (windowHeight - (el._fx.offsetTop - scrolledTop + el._fx.height/2)) ) / (windowHeight/2)  // parallax translate Y where 50% of viewport height is 0%
        }
      }
    }

    self.CT_onmouse_fn = function() {
      if(self.CT_mouse_elements.length) {
        for(const el of self.CT_mouse_elements) {
          for( const transform of el._fx.onmouse_transforms ) {
            if( transform.hasMultiValues ){ for(const [i] of Object.entries(transform.multiValues)){ self.CT_addCSSVars({ "el": el, "cssVar": `${transform.cssVar}-${parseInt(i)+1}`, "start": transform.multiValues[i].start, "end": transform.multiValues[i].end, "percents": self.mousePercents(el)[transform.options.origin].m, "reverse": transform.options.reverse, "unit": transform.multiValues[i].unit}); }
            } else{ self.CT_addCSSVars({ "el": el, "cssVar": transform.cssVar, "start": transform.start, "end": transform.end, "percents": self.mousePercents(el)[transform.options.origin].m, "reverse": transform.options.reverse, "unit": transform.unit }); }
          }
        }
      }
      if(self.CT_mouseX_elements_length) {
        for(const el of self.CT_mouseX_elements) {
          for( const transform of el._fx.onmouseX_transforms ) {
            if( transform.hasMultiValues ){ for(const [i] of Object.entries(transform.multiValues)){ self.CT_addCSSVars({ "el": el, "cssVar": `${transform.cssVar}-${parseInt(i)+1}`, "start": transform.multiValues[i].start, "end": transform.multiValues[i].end, "percents": self.mousePercents(el)[transform.options.origin].mx, "reverse": transform.options.reverse, "unit": transform.multiValues[i].unit}); }
            } else{ self.CT_addCSSVars({ "el": el, "cssVar": transform.cssVar, "start": transform.start, "end": transform.end, "percents": self.mousePercents(el)[transform.options.origin].mx, "reverse": transform.options.reverse, "unit": transform.unit }); }
            // el.style.setProperty(transform.cssVar, `${transform.start + ((transform.end - transform.start) * (self.mousePercents(el)[transform.options.origin].mx * (transform.options.reverse ? (-1) : 1)) )}${transform.unit}` );
          }
        }
      }
      if(self.CT_mouseY_elements_length) {
        for(const el of self.CT_mouseY_elements) {
          for( const transform of el._fx.onmouseY_transforms ) {
            if( transform.hasMultiValues ){ for(const [i] of Object.entries(transform.multiValues)){ self.CT_addCSSVars({ "el": el, "cssVar": `${transform.cssVar}-${parseInt(i)+1}`, "start": transform.multiValues[i].start, "end": transform.multiValues[i].end, "percents": self.mousePercents(el)[transform.options.origin].my, "reverse": transform.options.reverse, "unit": transform.multiValues[i].unit}); }
            } else{ self.CT_addCSSVars({ "el": el, "cssVar": transform.cssVar, "start": transform.start, "end": transform.end, "percents": self.mousePercents(el)[transform.options.origin].my, "reverse": transform.options.reverse, "unit": transform.unit }); }
            // el.style.setProperty(transform.cssVar, `${transform.start + ((transform.end - transform.start) * (self.mousePercents(el)[transform.options.origin].my * (transform.options.reverse ? (-1) : 1)) )}${transform.unit}` );
          }
        }
      }
    }

    self.CT_onscroll_fn = function() {
      if(self.CT_scroll_elements.length) {
        for(const el of self.CT_scroll_elements) {
          if(self.inviewCheck(el)){
            for( const transform of el._fx.onscroll_transforms ) {
              let isParallax = transform.options.offset === "parallax";
              let SP = self.scrollPercents(el, transform.options.offset)[isParallax ? "parallax" : "regular"].sy;
              if( transform.hasMultiValues ) { for(const [i] of Object.entries(transform.multiValues)) { self.CT_addCSSVars({ "el": el, "cssVar": `${transform.cssVar}-${parseInt(i)+1}`, "start": transform.multiValues[i].start, "end": transform.multiValues[i].end, "percents": SP, "reverse": transform.options.reverse, "unit": transform.multiValues[i].unit, "isParallax": isParallax, "isScroll": true }); }
              } else { self.CT_addCSSVars({ "el": el, "cssVar": transform.cssVar, "start": transform.start, "end": transform.end, "percents": SP, "reverse": transform.options.reverse, "unit": transform.unit, "isParallax": isParallax, "isScroll": true }); }
            }
          }
        }
      }
    }

    // Custom Transform Init
    //
    self.customTransformInit = function() {
      // Loop through all elements with "{action}:css-*" property
      //
      for(const el of self.customTransformElements) {

        // Declaration of array that will include transform properties
        // and options for each element
        //
        let onmouseTransformsArray = [];
        let onmouseXTransformsArray = [];
        let onmouseYTransformsArray = [];
        let onscrollTransformsArray = [];
        let onsensorTransformsArray = [];
        let activeTransformsArray = [];

        // Transform arrays assign to each {action}
        //
        let transforms = {
          "onmouse:ct-": onmouseTransformsArray,
          "onmouse-x:ct-": onmouseXTransformsArray,
          "onmouse-y:ct-": onmouseYTransformsArray,
          "onscroll:ct-": onscrollTransformsArray,
          "onsensor:ct-": onsensorTransformsArray,
          "h:ct-":        activeTransformsArray,
          "ta:ct-":       activeTransformsArray,
          "th:ct-":       activeTransformsArray,
          "a:ct-":        activeTransformsArray,
          "iv:ct-":       activeTransformsArray
        }

        // Parallax and Tilt effects first
        //
        for(const dataFxAttr of el.getAttribute("data-fx").split(" ")) {
          if( dataFxAttr.match(/(:ct-tilt)|(:ct-parallax)+/g) && dataFxAttr.match(/(onmouse)|(onscroll)+/g) ) {

            let origin = dataFxAttr.indexOf("__origin") >= 0 ? getProperties(dataFxAttr.split("__")[1]).value : "negative";
            let end = getCT(dataFxAttr).end;

            dataFxAttr.indexOf("onmouse-x:ct-tilt")      >=0 && self.add(el, `onmouse-x:ct-rotateY[${ (-1)*end }deg;0deg]__origin[${ origin }]`);
            dataFxAttr.indexOf("onmouse-y:ct-tilt")      >=0 && self.add(el, `onmouse-y:ct-rotateX[${ end }deg;0deg]__origin[${ origin }]`);
            dataFxAttr.indexOf("onmouse-x:ct-parallax")  >=0 && self.add(el, `onmouse-x:ct-translateX[0px;${ end }px]__origin[parallax]`);
            dataFxAttr.indexOf("onmouse-y:ct-parallax")  >=0 && self.add(el, `onmouse-y:ct-translateY[0px;${ end }px]__origin[parallax]`);
            dataFxAttr.indexOf("onscroll:ct-parallax")   >=0 && self.add(el, `onscroll:ct-translateY[${ end }px;0px]__offset[parallax]`);

            if( dataFxAttr.match(/(onmouse)+/g) && (/[^-x](:ct-tilt)*[^-y](:ct-tilt)+/g).test(dataFxAttr) )          self.add(el, `onmouse-x:ct-rotateY[${ (-1)*end }deg;0deg]__origin[${ origin }] onmouse-y:ct-rotateX[${ end }deg;0deg]__origin[${ origin }]`), self.CT_mouseX_elements.push(el), self.CT_mouseY_elements.push(el);
            if( dataFxAttr.match(/(onmouse)+/g) && (/[^-x](:ct-parallax)*[^-y](:ct-parallax)+/g).test(dataFxAttr) )  self.add(el, `onmouse-x:ct-translateX[0px;${ end }px]__origin[parallax] onmouse-y:ct-translateY[0px;${ end }px]__origin[parallax]`),          self.CT_mouseX_elements.push(el), self.CT_mouseY_elements.push(el);

            // Removes presence of original attribute
            //
            self.remove(el, dataFxAttr);
          }
        }

        // Push element (el) to corresponding array, add corresponding EventListener and call window EventListener
        //
        el.getAttribute("data-fx").indexOf("onmouse:ct-")    >= 0 && self.CT_mouse_elements.push(el),  self.initEventListeners({initMouseEvent: true});
        el.getAttribute("data-fx").indexOf("onmouse-x:ct-")  >= 0 && self.CT_mouseX_elements.push(el), self.initEventListeners({initMouseEvent: true});
        el.getAttribute("data-fx").indexOf("onmouse-y:ct-")  >= 0 && self.CT_mouseY_elements.push(el), self.initEventListeners({initMouseEvent: true});
        el.getAttribute("data-fx").indexOf("onscroll:ct-")   >= 0 && self.CT_scroll_elements.push(el), self.initEventListeners({initScrollEvent: true});

        // Loop through each data-fx property
        //
        for(const dataFxAttr of el.getAttribute("data-fx").split(" ")) {
          // Loop through each transform array
          //
          if(dataFxAttr.indexOf(":ct-") >= 0) {
            for( const [transformKey, transformArray] of Object.entries(transforms) ) {
              // If data-fx property is in the transform array, push options into "transform options array"
              //
              if(dataFxAttr.indexOf(transformKey) >= 0) {
                let CT = getCT(dataFxAttr);
                let GP = getProperties(dataFxAttr);

                transformArray.push({
                  name:     GP.activeName,
                  start:    CT.start,
                  end:      CT.end,
                  unit:     CT.unit,
                  name:     CT.name,
                  cssVar:   CT.cssVariable,
                  options:  GP.options,
                  hasMultiValues: CT.hasMultiValues,
                  multiValues: CT.multiValues
                });

                if( (/(h\:ct-)|(a\:ct-)|(th\:ct-)|(ta\:ct-)|(iv\:ct-)+/g).test(transformKey) ) {
                  for(const transform of transformArray) {
                    el.style.setProperty(`--ct-${CT.name}`, `${transform.start}${transform.unit}`);
                    el.style.setProperty(`--ct-${CT.name}-active`, `${transform.end}${transform.unit}`);
                  }
                }
              }

            }
          }
        }

        // Set basic element bounds (top, left, width...)
        //
        self.setBounds(el);

        // Assign "transform options array" into element's "onmouse_transforms" object
        //
        if(onmouseTransformsArray.length)  el._fx.onmouse_transforms  = onmouseTransformsArray;
        if(onmouseXTransformsArray.length) el._fx.onmouseX_transforms = onmouseXTransformsArray;
        if(onmouseYTransformsArray.length) el._fx.onmouseY_transforms = onmouseYTransformsArray;
        if(onscrollTransformsArray.length) el._fx.onscroll_transforms = onscrollTransformsArray;
        if(activeTransformsArray.length) el._fx.hover_transforms = activeTransformsArray;
      }

      self.CT_mouse_elements_length  = self.CT_mouse_elements.length;
      self.CT_mouseX_elements_length  = self.CT_mouseX_elements.length;
      self.CT_mouseY_elements_length  = self.CT_mouseY_elements.length;

      // Add custom "onmouseEvent" to document
      //
      (self.CT_mouse_elements_length || self.CT_mouseX_elements_length || self.CT_mouseY_elements_length) && document.addEventListener("onmouseEvent",  self.CT_onmouse_fn);
      (self.CT_scroll_elements.length) && document.addEventListener("onscrollEvent",  self.CT_onscroll_fn);
      // if(self.CT_hover_elements.length) for(const el of self.CT_hover_elements) { el.addEventListener("mouseenter",  self.CT_onmouseenter_fn); el.addEventListener("mouseleave",  self.CT_onmouseleave_fn); }

      self.CT_onscroll_fn();
    }

    //
    // ------------------------------------------------------------------------
    // EVENT LISTENERS INIT
    // ------------------------------------------------------------------------
    //
    self.initEventListeners = function(params){
      if( params.initScrollEvent ){
        window.addEventListener("scroll", self.onScroll, {passive: true});
      }
      if( params.initMouseEvent ){
        window.addEventListener("mousemove", self.onMouseMove, {passive: true});
      }
      if( params.initSensorEvent ){
        window.addEventListener("deviceorientation", self.onSensor, {passive: true});
      }
    }

    //
    // ------------------------------------------------------------------------
    // EVENT LISTENERS FUNCTIONS
    // ------------------------------------------------------------------------
    //
    // On Scroll RAF
    //
    self.onScroll = function() {
      let raf;
      raf && window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(function(){
        scrolledTop = window.pageYOffset || document.documentElement.scrollTop;
        document.dispatchEvent(CT_onscroll_event);
      });
    }

    // On Mouse Move RAF
    //
    self.onMouseMove = function(e){
      let raf;
      raf && window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(function(){
        mouseX = e.clientX;
        mouseY = e.clientY;
        document.dispatchEvent(CT_onmouse_event);
      });
    }

    // On Sensor Orientation RAF
    //
    self.onSensor = function(e) {
      if(e) {
        let raf;
        sensorEnabled = true;
        raf && window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(function(){
          sensorGamma = e.gamma;
          sensorBeta = e.beta;
        });
      }
    }
    // On Mouse Enter
    //
    self.onMouseEnter = function(e){
      // console.log(e);
      // tiltHoverEl = e.target;
    }
    // On Mouse Leave
    //
    self.onMouseLeave = function(){
      // tiltHoverEl.style.setProperty(`--tiltX`, `0deg`);
      // tiltHoverEl.style.setProperty(`--tiltY`, `0deg`);
      // tiltHoverEl = false;
    }

    //
    // ------------------------------------------------------------------------
    // METHODS
    // ------------------------------------------------------------------------
    //
    // ADD New properties into element
    //
    self.add = function(elements, property) {
      self.addOrRemoveProperty(elements, property, "add");
    }
    // REMOVE Property from [data-fx]
    //
    self.remove = function(elements, property) {
      self.addOrRemoveProperty(elements, property, "remove");
    }
    // ADD or REMOVE property helper function
    //
    self.addOrRemoveProperty = function(elements, property, method){
      if(!property) {
        console.warn("No property!");
        return;
      }
      // Select all elements and add a [data-fx] properties
      //
      let elementsArr = [];

      if(typeof elements === "object") {
        elementsArr.push(elements);
      } else {
        for(const el of Array.from(document.querySelectorAll(elements)) ) {
          elementsArr.push(el);
        }
      }

      for(const el of elementsArr) {
        self.el = el;
        self.property = property;

        if( self.el.hasAttribute("data-fx") ){
          let dataFx = self.el.getAttribute("data-fx").split(" ");
          for( let propertyToAddOrRemove of self.property.split(" ") ){
            if( method === "add" ){
              dataFx.indexOf(propertyToAddOrRemove) === -1 && dataFx.push(propertyToAddOrRemove);
            } else if( method === "remove" ){
              dataFx.indexOf(propertyToAddOrRemove) >= 0 && dataFx.splice(dataFx.indexOf(propertyToAddOrRemove), 1);
            }
          }
          self.el.setAttribute("data-fx", dataFx.join(" "));
          self.findAndSetCustomProperties(self.el);
        } else {
          if( method === "add" ){
            self.el.setAttribute("data-fx", self.property);
          } else if( method === "remove" ){
            console.warn("No [data-fx] attribute to remove!");
          }
        }
      }

      typeof elements !== "object" && self.init();
    }
    // DESTROY any [data-fx]
    //
    self.destroy = function(elements) {
      if(!elements) {
        elements = "[data-fx]";
      }
      for(const el of document.querySelectorAll(elements)) {
        el.removeAttribute("data-fx");
        el.classList.remove("inview");
      }
      window.removeEventListener("scroll", self.inviewListenerRAF);
    }

    //
    // ------------------------------------------------------------------------
    // INTERNAL HELPER FUNCTIONS
    // ------------------------------------------------------------------------
    //
    // Set element bounds, position, center...
    //
    self.setBounds = function(el){
      el._fx.top            = Math.round(el.getBoundingClientRect().top);
      el._fx.left           = Math.round(el.getBoundingClientRect().left);
      el._fx.offsetTop      = Math.round(el.getBoundingClientRect().top)  + (window.pageYOffset || document.documentElement.scrollTop);
      el._fx.offsetLeft     = Math.round(el.getBoundingClientRect().left) + (window.pageXOffset || document.documentElement.scrollLeft);
      el._fx.width          = el.clientWidth;
      el._fx.height         = el.clientHeight;
      el._fx.centerX        = el._fx.offsetLeft + el._fx.width/2-scrolledLeft;
      el._fx.centerY        = el._fx.offsetTop  + el._fx.height/2-scrolledTop;
      el._fx.maxDiagonal    = Math.round(self.getMaxSide(el).corner);
      el._fx.maxXSide       = self.getMaxSide(el).xSide;
      el._fx.maxYSide       = self.getMaxSide(el).ySide;
    }
    // Get max side/hypotenuse - calculates element's center against the screen corners and sides
    // and select the biggest one as a reference side
    //
    self.getMaxSide = function(el) {
      let lt = Math.sqrt(Math.pow(el._fx.centerX,2) + Math.pow(el._fx.centerY,2));
      let lb = Math.sqrt(Math.pow(el._fx.centerX,2) + Math.pow(windowHeight-el._fx.centerY,2));
      let rt = Math.sqrt(Math.pow(windowWidth-el._fx.centerX,2) + Math.pow(el._fx.centerY,2));
      let rb = Math.sqrt((Math.pow(windowWidth-el._fx.centerX,2) + Math.pow(windowHeight-el._fx.centerY,2)));
      let ls = el._fx.centerX;
      let rs = windowWidth - el._fx.centerX;
      let ts = el._fx.centerY;
      let bs = windowHeight - el._fx.centerY;
      let corner = Math.max(...[lt,lb,rt,rb]);
      let xSide = Math.max(...[ls, rs]);
      let ySide = Math.max(...[ts, bs]);
      return { corner, xSide, ySide };
    }
    // Get mouse position. Used in origin[self] option when {onmouse:} action
    //
    self.getMouseHoverPosition = function(el, centerX, centerY) {
      return 1 - Math.abs( Math.sqrt(Math.pow(Math.abs(centerX-mouseX),2) + Math.pow(Math.abs(centerY-mouseY),2)) / el._fx.maxDiagonal );
    }
    // Add CSS variables on custom transform action
    //
    self.CT_addCSSVars = function(parameters){
      let el          = parameters.el;
      let cssVar      = parameters.cssVar;
      let start       = parameters.start;
      let end         = parameters.end;
      let percents    = parameters.percents;
      let reverse     = parameters.reverse;
      let unit        = parameters.unit;
      let isParallax  = parameters.isParallax;
      let isScroll    = parameters.isScroll;

      el.style.setProperty(cssVar, `${start + ((end - start) * (percents * (reverse ? (-1) : 1)) )}${unit}` );
      ( (percents < 0 && !isParallax) && (percents < 0 && !!isScroll) ) &&  el.style.setProperty(cssVar, `${start}${unit}` );
      ( (percents > 1 && !isParallax) && (percents > 1 && !!isScroll) ) &&  el.style.setProperty(cssVar, `${end}${unit}` );
    }

    //
    // ------------------------------------------------------------------------
    // INIT
    // ------------------------------------------------------------------------
    //
    // Initialization
    //
    self.init = function(elements, property) {

      self.inviewElements = [];
      self.customTransformElements = [];

      if(!elements) {
        elements = "[data-fx]";
      }

      // Loop through all corresponding elements
      //
      for(const el of document.querySelectorAll(elements)) {
        self.el = el;
        self.property = property;
        self.addDataFx();

        ( (!!self.el.getAttribute("data-fx")) && self.el.getAttribute("data-fx").indexOf("iv:") >= 0 ) && self.inviewElements.push(self.el);
        // ( (!!self.el.getAttribute("data-fx")) && self.el.getAttribute("data-fx").indexOf("parallax") >= 0 || self.el.getAttribute("data-fx").indexOf("tilt") >= 0 ) && self.parallaxElements.push(self.el);
        ( (!!self.el.getAttribute("data-fx")) && self.el.getAttribute("data-fx").indexOf(":ct-") >= 0 ) && self.customTransformElements.push(self.el);
      }

      // self.parallaxElements.length > 0 &&  self.parallaxInit();
      self.customTransformElements.length > 0 &&  self.customTransformInit();

      // If there is element with data-fx=*iv:, initialize inview function
      //
      window.addEventListener("load", () => {
        self.inviewElements.length > 0 && self.inviewInit();
      });

      console.log(self.inviewElements);
    }

    // Immediately init
    //
    self.init(el, property);

    //
    // ------------------------------------------------------------------------
    // RETURNS
    // ------------------------------------------------------------------------
    //
    return {
      add: self.add,
      destroy: self.destroy,
      init: self.init,
      remove: self.remove,
      inviewInit: self.inviewInit
    }
  }

  /**
   * Group FX [data-group-fx]
   */
  let TorusGroupFX = function(el, property) {

    let self = this;

    // Add [data-fx] into all corresponding elements
    //
    self.addGroupDataFx = function() {
      let countingValue = 0;
      for(const el of self.el.querySelectorAll(".fx") ) {
        let propertiesArray = [];
        for(let dataFxAttr of self.property.split(" ")) {
          if( (/(\+)|(~)+/g).test(dataFxAttr) ) {
            let GP = getProperties(dataFxAttr);
            let GU = getUnit(GP.value);
            if( (/(\+)+/g).test(dataFxAttr) ) dataFxAttr = `${GP.name}[${(countingValue * GU.integerValue)}${GU.unit}]`, countingValue = countingValue + 1;
            if( (/(~)+/g).test(dataFxAttr) )  dataFxAttr = `${GP.name}[${( (Math.floor(Math.random() * (GU.integerValue - 0)) + 0) )}${GU.unit}]`;
          }
          propertiesArray.push(dataFxAttr);
        }
        el.setAttribute("data-fx", propertiesArray.join(" "));
      }
      TORUS.fx.init();
    }

    // Init
    //
    self.init = function(elements, property) {
      if(!elements) {
        elements = "[data-group-fx]";
      }
      // Loop through all corresponding elements
      //
      for(const el of document.querySelectorAll(elements)) {
        self.el = el;
        self.property = property ? property : (self.el.getAttribute("data-group-fx")) ? self.el.getAttribute("data-group-fx") : console.warn("No [data-group-fx] property");
        self.addGroupDataFx();
      }
    }

    self.init(el, property);

    // Returns
    //
    return {
      init: self.init
    }
  }

  /**
   * Loops [data-loop]
   */
  let TorusLoop = function() {
    this.init = function(){
      for(const el of document.querySelectorAll("[data-loop*='[']")) {
        for(const elLoop of el.getAttribute("data-loop").split(" ")){
          if (elLoop.indexOf("[") >= 0 && elLoop.indexOf("]") >= 0) {
            let propertyName, propertyValue;

            propertyName = elLoop.slice(0, elLoop.indexOf("["));
            propertyValue = elLoop.slice(elLoop.indexOf("[") + 1, elLoop.indexOf("]"));
            valuesArray = propertyValue.split(":");

            if (propertyName) {
              el.style.setProperty(`--a-${propertyName}`, propertyValue);
            } else {
              if (valuesArray[1]) {
                el.style.setProperty(`--av-${valuesArray[0]}`, valuesArray[1]);
              } else {
                el.style.setProperty("--av-default", valuesArray[0]);
              }
            }
          }
        }
      }
    }

    this.init();
  }

  /**
   * Position [data-position]
   */

  let TorusPosition = function() {
    this.init = function(){
      for(const el of document.querySelectorAll("[data-position*='[']")) {
        for(const elLoop of el.getAttribute("data-position").split(" ")){
          if (elLoop.indexOf("[") >= 0 && elLoop.indexOf("]") >= 0) {
            let GP              = getProperties(elLoop);
            let action          = GP.action;
            let name            = GP.name;
            let propertyValue   = GP.value;
            el.style.setProperty(`--${name}` + ((!!action) ? `-${action}` : ""), propertyValue);
          }
        }
      }
    }

    this.init();
  }

  /**
   * Custom class property
   */
  let TorusClassProperty = function() {
    this.init = function(){
      for(const el of document.querySelectorAll("[class*='[']")) {
        for(const elClass of el.classList){
          if (elClass.indexOf("[") >= 0 && elClass.indexOf("]") >= 0) {
            let propertyName, propertyValue;

            propertyName = elClass.slice(0, elClass.indexOf("["));
            propertyValue = elClass.slice((elClass.indexOf("[") + 1), elClass.indexOf("]"));
            el.classList.add("notrans");
            el.style.setProperty(`--${propertyName}`, propertyValue);

            setTimeout(() => el.classList.remove("notrans"), 10);
          }
        }
      }
    }

    this.init();
  }

  /**
   * Inits
   */
  TORUS.fx = new TorusFx();
  TORUS.groupFx = new TorusGroupFX();
  TORUS.loop = new TorusLoop();
  TORUS.position = new TorusPosition();
  TORUS.classProperty = new TorusClassProperty();

  // setTimeout(() => TORUS.groupFx = new TorusGroupFX(), 20);

  //
  // ------------------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------------------
  //
  // String to camel case
  //
  function toCamelCase(str) {
    return str.replace( /[-_]+/g, ' ').replace( / (.)/g, function($1) { return $1.toUpperCase(); }).replace( / /g, '' );
  }

  function calculateTransform(elementPosition, customValue, multiplier) {
    return Math.round( elementPosition * customValue * multiplier * 1000 )/1000;
  }

  // Get Custom Transform
  //
  function getCT(value) {
    let multiValues = {};
    let GP = getProperties(value);
    let hasMultiValues = (/({)+/g).test(GP.value) && (/(})+/g).test(GP.value);

    let action      = GP.action;
    let start       = !hasMultiValues ? getUnit( GP.value.split(";")[0] ).integerValue : false;
    let end         = !hasMultiValues ? !!GP.value.split(";")[1] ? getUnit( GP.value.split(";")[1] ).integerValue : GP.value : false;
    let unit        = !!GP.value.split(";")[0] && getUnit(GP.value.split(";")[0]).unit || !!GP.value.split(";")[1] && getUnit(GP.value.split(";")[1]).unit || ""; // Get "unit" from the "start" value. If it doesn't exist, get it from "end" otherwise set ""
    let cssVariable = `--ct-${ action.split("-")[0] }-${ GP.name.split("ct-")[1]}`;
    let name        = `${ GP.name.split("ct-")[1]}`;

    // console.log(start, end);

    if(hasMultiValues) {

      let startValues = GP.value.split(";")[0].replace(/({)|(})+/g,"").split(",");
      let endValues   = GP.value.split(";")[1].replace(/({)|(})+/g,"").split(",");

      for(const [index, singleValue] of Object.entries(startValues) ) {
        if(singleValue === "--") continue;
        multiValues[index]       = {};
        multiValues[index].start = getUnit(startValues[index]).integerValue;
        multiValues[index].end   = getUnit(endValues[index]).integerValue;
        multiValues[index].unit  = getUnit(startValues[index]).unit || getUnit(endValues[index]).unit;
      }
    }

    if(end === undefined) { end = start; start = 0; } // If the "end" value doesn't exists set it a "start" value, and add 0 as a "start".

    return { action, start, end, unit, cssVariable, name, hasMultiValues, multiValues }
  }

  // Get Properties
  //
  function getProperties(property) {
    let options = {};

    let action      = property.indexOf(":") >= 0 ? property.substring( 0, property.indexOf(":") ) : false;
    let name        = property.substring( property.indexOf(":") >= 0 ? property.indexOf(":")+1 : 0, property.indexOf("[") >= 0 ? property.indexOf("[") : property.length ).replace(/^ +/g, "");
    // let value       = property.substring( property.indexOf("[")+1, property.indexOf("]") );
    let value       = property.substring( property.indexOf("[")+1, property.indexOf("]") ).replace(/_+/g, " ");
    let activeName  = (!!action) ? toCamelCase(`${action}:${name}`).replace(":", "_").replace(/h_|a_|th_|ta_|iv_+/g,"active_") : toCamelCase(name);

    if(property.indexOf("]__") >= 0) {
      for(const [i, option] of Object.entries(property.replace(/\]__/g, "]]__").split("]__"))) {  // Loop through every option separated by "]__" in data-fx
        if(i > "0") options[getProperties(option).name] = getProperties(option).value;  // Set "value" to option "name"
      }
    }

    // Default settings for some effects
    //
    if(property.indexOf("onscroll") >= 0 && !options.offset)   options.offset = "50";
    if(property.indexOf("onmouse")  >= 0 && !options.origin)   options.origin = "middle";
    if(property.indexOf(":ct-parallax") >= 0)                  options.origin = "parallax";
    if(property.indexOf("onscroll:ct-parallax") >= 0)          options.offset = "parallax";

    return { action, name, value, activeName, options }
  }

  // Get value and unit
  //
  function getUnit(propertyValue) {
    return {
      // integerValue: (/\d/.test(propertyValue))*!(/ /.test(propertyValue)) ? !!parseInt(propertyValue) ? parseInt(propertyValue) : parseFloat(propertyValue) : propertyValue,
      integerValue: (/\d/.test(propertyValue))*!(/ /.test(propertyValue)) ? (/\.+/g).test(propertyValue) ? parseFloat((/([0-9]*[.])?[0-9]+/g).exec(propertyValue)[0]) : parseInt((/[+-]?(\d)+/g).exec(propertyValue)[0]) : propertyValue,
      // unit        : (/\d/.test(propertyValue)) ? (/\./g).test(propertyValue) ? propertyValue.split(parseFloat(propertyValue))[1] : propertyValue.split(parseInt(propertyValue, 10))[1] : false
      unit        : (/\d/.test(propertyValue))*!(/ /.test(propertyValue)) ? propertyValue.split((/[+-]?([0-9]*[.])?[0-9]+/g).exec(propertyValue)[0])[1] : false
    }
  }

  // Remove spaces in data-fx string
  //
  function removeSpaces(string, replacement) {
    let oldString = string;
    let newString, re, replacedPattern;

    for( const pattern of replacement.split("|") ) {
      replacedPattern = pattern.replace(/ /g, "");
      re = new RegExp(pattern, "g");
      newString = oldString.replace(re, replacedPattern);
      oldString = newString.replace(/\\+/g, "");
    }
    return newString;
  }

}());

/**
 * jQuery functions
 */
window.addEventListener("load", () => {
  if(window.jQuery) {
    (function($) {
      /**
       * Bootstrap Carousel fluid height
       */
      (function() {
        var $carouselFluid = $(".carousel-fluid");

        $($carouselFluid).on("slide.bs.carousel", function(e) {
          var height = $($(this).find(".carousel-item")[e.from]).height();
          $(this).height(height);
        });

        $($carouselFluid).on("slid.bs.carousel", function(e) {
          $(this).height($(e.relatedTarget).outerHeight(true));
        });
      })();

      (function() {
        $(".carousel-multiple").on("click", function() {
          $($(this).attr("data-target")).carousel(parseInt($(this).attr("data-slide-to")));
        })
      })();

      /**
       * Bootstrap Popover styles
       */
      (function() {
        $('[data-toggle="popover"]').on('inserted.bs.popover', function(e) {
          if ($(e.target).attr("data-popover-style")) {
            var popover = $("#" + $(e.target).attr("aria-describedby"));
            popover.attr("data-popover-style", $(e.target).attr("data-popover-style"));
          }
        })
      })();

      /**
       * Bootstrap Tooltip styles
       */
      (function() {
        $('[data-toggle="tooltip"]').on("inserted.bs.tooltip", function(e) {
          if ($(e.target).attr("data-tooltip-style")) {
            var tooltip = $("#" + $(e.target).attr("aria-describedby"));
            tooltip.attr("data-tooltip-style", $(e.target).attr("data-tooltip-style"));
          }
        })
      })();

      /**
       * Bootstrap Tabs Animated
       */
      (function() {
        $(document).on("shown.bs.tab", "a[data-toggle='tab']", function(e) {
          var $relatedTab = $($(e.relatedTarget).attr("href") + ".tab-pane");
          var $relatedTabContent = $relatedTab.closest(".tab-content");

          var $tab = $($(e.target).attr("href") + ".tab-pane");
          var $tabContent = $tab.closest(".tab-content");

          if ($tabContent.hasClass("tab-content-fluid")) {
            $relatedTabContent.height($relatedTab.outerHeight(true));
            $tabContent.height($tab.outerHeight(true));
            $tabContent[0].addEventListener("transitionend", setAutoHeight, true);
          }

          function setAutoHeight(e) {
            if (e.propertyName === "height") {
              $tabContent.css("height", "auto");
              $tabContent[0].removeEventListener("transitionend", setAutoHeight, true);
            }
          }
        });
      })();

      /**
       * Bootstrap Alert Animated
       */
      (function() {
        $("[data-animate-dismiss='alert']").on("click", function() {
          var parent = $(this).closest(".alert");
          parent.css("height", parent[0].offsetHeight + "px").addClass("closing");
          setTimeout(function() {
            parent.addClass("closed");
            setTimeout(function() {
              parent.alert("close");
            }, 300);
          }, 300);
        });
      })();

      /**
       * Bootstrap Toast fluid animation
       */
      (function() {

        $(document).on("show.bs.toast", ".toast-fluid", function() {
          if (!$(this).hasClass("show")) {
            $(this).css("height", 0);
            $(this)[0]._isHidden = true;
          }
        });

        $(document).on("shown.bs.toast", ".toast-fluid", function() {
          var $this = $(this);

          if ($(this)[0]._isHidden === true) {
            $(this).css("height", $(this).find(".toast-wrapper").height());
            $(this)[0]._isHidden = false;
          }

          $(this)[0].addEventListener("transitionend", setAutoHeight, true);

          function setAutoHeight(e) {
            if (e.propertyName === "height") {
              $this.css("height", "auto");
              $this[0].removeEventListener("transitionend", setAutoHeight, true);
            }
          }
        });

        $(document).on("hidden.bs.toast", ".toast-fluid", function() {
          var $this = $(this);
          $(this).css("height", $(this).find(".toast-wrapper").height());
          $(this).css("height", 0);

          if ($this.attr("data-toast-remove") === "true") {
            $this[0].addEventListener("transitionend", function listener(e) {
              if (e.propertyName === "height") {
                $this.remove();
                $this[0].removeEventListener("transitionend", listener, true);
              }
            }, true);
          }
        });
      })();
    }(jQuery));
  }
});
