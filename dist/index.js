!function(t,e,r,n,l){var i="u">typeof globalThis?globalThis:"u">typeof self?self:"u">typeof window?window:"u">typeof global?global:{},o="function"==typeof i[n]&&i[n],a=o.i||{},s=o.cache||{},c="u">typeof module&&"function"==typeof module.require&&module.require.bind(module);function u(e,r){if(!s[e]){if(!t[e]){if(l[e])return l[e];var a="function"==typeof i[n]&&i[n];if(!r&&a)return a(e,!0);if(o)return o(e,!0);if(c&&"string"==typeof e)return c(e);var d=Error("Cannot find module '"+e+"'");throw d.code="MODULE_NOT_FOUND",d}p.resolve=function(r){var n=t[e][1][r];return null!=n?n:r},p.cache={};var h=s[e]=new u.Module(e);t[e][0].call(h.exports,p,h,h.exports,i)}return s[e].exports;function p(t){var e=p.resolve(t);if(!1===e)return{};if(Array.isArray(e)){var r={__esModule:!0};return e.forEach(function(t){var e=t[0],n=t[1],l=t[2]||t[0],i=u(n);"*"===e?Object.keys(i).forEach(function(t){"default"===t||"__esModule"===t||Object.prototype.hasOwnProperty.call(r,t)||Object.defineProperty(r,t,{enumerable:!0,get:function(){return i[t]}})}):"*"===l?Object.defineProperty(r,e,{enumerable:!0,value:i}):Object.defineProperty(r,e,{enumerable:!0,get:function(){return"default"===l?i.__esModule?i.default:i:i[l]}})}),r}return u(e)}}u.isParcelRequire=!0,u.Module=function(t){this.id=t,this.bundle=u,this.require=c,this.exports={}},u.modules=t,u.cache=s,u.parent=o,u.distDir=void 0,u.publicUrl=void 0,u.devServer=void 0,u.i=a,u.register=function(e,r){t[e]=[function(t,e){e.exports=r},{}]},Object.defineProperty(u,"root",{get:function(){return i[n]}}),i[n]=u;for(var d=0;d<e.length;d++)u(e[d]);if(r){var h=u(r);"object"==typeof exports&&"u">typeof module?module.exports=h:"function"==typeof define&&define.amd&&define(function(){return h})}}({"8RSWf":[function(t,e,r,n){!function(){let t=function(){let t=window;try{for(;t.parent&&t.parent!==t;)t=t.parent}catch(t){}return t}(),e=t.document,r=window,n=document,l="__LIA_TEXTMARKER_REG_V4__";t[l]=t[l]||{instances:{}};let i=t[l],o=(n.baseURI||r.location.href||"")+"::"+(n.title||""),a=i.instances[o];if(a?.__alive){try{a.moSlides?.disconnect()}catch(t){}try{a.__alive=!1}catch(t){}try{a.moDock?.disconnect()}catch(t){}try{a.moTheme?.disconnect()}catch(t){}try{a.roLayout?.disconnect()}catch(t){}try{a.__layoutTimer&&t.clearInterval(a.__layoutTimer)}catch(t){}try{a.__slideSyncTimer&&t.clearInterval(a.__slideSyncTimer)}catch(t){}try{n.getElementById("lia-hl-overlay")?.remove()}catch(t){}try{a.__realSlideWatchTimer&&t.clearInterval(a.__realSlideWatchTimer)}catch(t){}}let s=i.instances[o]={__alive:!0,debugHLQ:!1,state:{active:!1,panelOpen:!1,tool:"mark",color:"yellow"},HL:[],nextId:1,moDock:null,moTheme:null,moSlides:null,roLayout:null,roNodes:new Set,roPending:!1,ticking:!1,__activeSlide:null,posTimers:[],lastBurstAt:0},c="lia-hl-ui-overlay-v1";function u(t,e,r){let n=t.getElementById(e);if(n){n.textContent=r;return}let l=t.createElement("style");l.id=e,l.textContent=r,t.head.appendChild(l)}function d(){u(n,"lia-hl-style-static-v4",`
    /* HLQ: Basisstyles f\xfcr Proxy/Quiz */
    .hlq-proxy{
      display: inline-flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      margin: 0 !important;
      padding: 0 !important;
      gap: 0 !important;
    }

    /* unsere UI standardm\xe4\xdfig komplett raus */
    .hlq-proxy .hlq-btn,
    .hlq-proxy .hlq-msg{
      display: none !important;
    }

    /* Lia-Teil bleibt inline und ohne extra Block-Abst\xe4nde */
    .hlq-proxy .hlq-lia{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin: 0 !important;
      padding: 0 !important;
      font-size: 0 !important;
    }

    .hlq-proxy .hlq-lia button,
    .hlq-proxy .hlq-lia [role="button"],
    .hlq-proxy .hlq-lia a{
      font-size: 1rem !important;
    }

    /* Debug: wenn du es brauchst */
    body.lia-hlq-debug .hlq-proxy{ gap: 10px !important; }
    body.lia-hlq-debug .hlq-proxy .hlq-btn{ display: inline-flex !important; }
    body.lia-hlq-debug .hlq-proxy .hlq-msg{ display: inline !important; }

    /* Markerquiz: keine Absatz-Abst\xe4nde zwischen Text und Quiz-Zeile */
    .markerquiz p{
      margin: 0 !important;
    }

    /* falls Lia leere <p> erzeugt (Parser-Autokorrektur), komplett weg */
    .markerquiz p:empty{
      display: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  `)}function h(t){let e=(t||"").match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);return e?{r:+e[1],g:+e[2],b:+e[3]}:null}function p(t,e,r){t.documentElement.style.setProperty(e,r)}function m(t){try{return(t?.ownerDocument?.defaultView||window).getComputedStyle(t)}catch(t){return null}}function f(t){if(!(t=String(t||"").trim()))return"";if(t.startsWith("rgb(")||t.startsWith("rgba(")||t.startsWith("hsl(")||t.startsWith("hsla(")||t.startsWith("#")||t.startsWith("var(")||/^[a-zA-Z]+$/.test(t))return t;if(/^\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?)?$/.test(t)){let e=t.split(",").map(t=>t.trim());return 3===e.length?`rgb(${e.join(", ")})`:`rgba(${e.join(", ")})`}return t}function g(){var t;let r;e.querySelector("header#lia-toolbar-nav")||e.querySelector("#lia-toolbar-nav")||e.querySelector("header.lia-header");let l=n.querySelector("main")||n.querySelector("[role='main']")||n.body,i=m(l),o=m(n.body),a=function(t){let e=t;for(let t=0;t<12&&e;t++){let t=getComputedStyle(e).backgroundColor;if(t&&"transparent"!==t&&"rgba(0, 0, 0, 0)"!==t)return t;e=e.parentElement}return null}(l)||i?.backgroundColor||o?.backgroundColor||"rgb(255,255,255)",s=(i?.color||"").trim()||(o?.color||"").trim()||"rgb(0,0,0)",c=.45>(r=(t=h(a)||{r:255,g:255,b:255}).r/255,.2126*r+.7152*(t.g/255)+.0722*(t.b/255)),u=function(){let t=[e.querySelector("#lia-toolbar-nav"),e.querySelector("header#lia-toolbar-nav"),e.querySelector("header.lia-header"),e.body,e.documentElement,n.querySelector("main"),n.body,n.documentElement];for(let e of["--color-highlight","--accent-color","--color-accent","--theme-highlight"]){let r=function(t,...e){for(let r of e){if(!r)continue;let e=m(r);if(!e)continue;let n=(e.getPropertyValue(t)||"").trim();if(n)return f(n)}return""}(e,...t);if(r)return r}return""}()||function(){let t=N?N():null,r=t?O(t):null;for(let t of[r,r?.querySelector("svg"),r?.querySelector("svg *"),r?.querySelector(".icon"),e.querySelector("#lia-toolbar-nav svg"),e.querySelector("#lia-toolbar-nav svg *"),e.querySelector("header.lia-header svg"),e.querySelector("header.lia-header svg *")]){if(!t)continue;let e=m(t);if(e){for(let t of[(e.getPropertyValue("stroke")||"").trim(),(e.getPropertyValue("fill")||"").trim(),(e.getPropertyValue("color")||"").trim()])if(t&&h(t)&&!function(t){let e=h(t);if(!e)return!1;let r=Math.max(e.r,e.g,e.b),n=Math.min(e.r,e.g,e.b);return!!(r<40)||!!(n>215)||!!(r-n<14)}(t))return t}}return""}();(u=f(u))||(u="rgb(11,95,255)");try{p(e,"--hl-accent",u)}catch(t){}try{p(n,"--hl-accent",u)}catch(t){}let d=f(a),g=f(s),y=c?"rgba(255,255,255,.68)":"rgba(0,0,0,.62)",b=c?"rgba(255,255,255,.16)":"rgba(0,0,0,.14)",v=c?"0 18px 44px rgba(0,0,0,.55)":"0 16px 42px rgba(0,0,0,.16)";try{p(e,"--hl-ui-bg",d)}catch(t){}try{p(n,"--hl-ui-bg",d)}catch(t){}try{p(e,"--hl-ui-fg",g)}catch(t){}try{p(n,"--hl-ui-fg",g)}catch(t){}try{p(e,"--hl-ui-muted",y)}catch(t){}try{p(n,"--hl-ui-muted",y)}catch(t){}try{p(e,"--hl-ui-border",b)}catch(t){}try{p(n,"--hl-ui-border",b)}catch(t){}try{p(e,"--hl-ui-shadow",v)}catch(t){}try{p(n,"--hl-ui-shadow",v)}catch(t){}let x=e.getElementById("lia-hl-btn");if(x){try{x.style.setProperty("color",u,"important")}catch(t){}try{x.style.setProperty("--hl-accent",u,"important")}catch(t){}let t=x.querySelector("svg");if(t){try{t.style.setProperty("color",u,"important")}catch(t){}try{t.style.setProperty("stroke",u,"important")}catch(t){}}}}d(),u(n,"lia-hl-style-content-v4",`
    :root{
      --hl-yellow: rgba(255, 247, 0, 0.45);
      --hl-green:  rgba(144, 238, 144, 0.45);
      --hl-blue:   rgba(0, 76, 255, 0.45);
      --hl-pink:   rgba(255, 0, 212, 0.45);
      --hl-orange: rgba(255, 153, 0, 0.45);
      --hl-red:    rgba(255, 0, 0, 0.45);

      --hl-ui-bg: rgba(255,255,255,.92);
      --hl-ui-fg: rgba(0,0,0,.88);
      --hl-ui-border: rgba(0,0,0,.14);
      --hl-ui-muted: rgba(0,0,0,.62);
      --hl-ui-shadow: 0 16px 42px rgba(0,0,0,.16);

      --hl-accent: rgb(11,95,255);
      --hl-z: 9999999;
    }

    #lia-hl-overlay{
      position: fixed !important;
      inset: 0 !important;
      z-index: calc(var(--hl-z) - 1) !important;
      pointer-events: none !important;
    }

    .lia-hl-rect{
      position: absolute !important;
      border-radius: 6px !important;
      box-shadow: 0 1px 0 rgba(0,0,0,.08) inset;
      mix-blend-mode: multiply;

      pointer-events: none !important;
      cursor: default !important;
    }

    /* Nur echte User-Markierungen d\xfcrfen angeklickt / radiert werden */
    .lia-hl-rect[data-kind="user"]{
      pointer-events: auto !important;
      cursor: pointer !important;
    }

        /* ---------------------------------------------------------
           Textmarker-Quiz Proxy: Lia-Buttons behalten, Input verstecken
           --------------------------------------------------------- */
        .hlq-proxy{
          display: inline-flex;
          align-items: center;
          gap: 0px;
          flex-wrap: wrap;
          margin: 0px 0;
        }

        /* Eingabefelder im Proxy verstecken (Buttons bleiben!) */
        .hlq-proxy input,
        .hlq-proxy textarea,
        .hlq-proxy select{
          display: none !important;
        }

        .hlq-proxy .hlq-msg{
          font-weight: 700;
          opacity: .85;
        }


    .lia-hl-rect[data-hl="yellow"]{ background: var(--hl-yellow); }
    .lia-hl-rect[data-hl="green"] { background: var(--hl-green);  }
    .lia-hl-rect[data-hl="blue"]  { background: var(--hl-blue);   }
    .lia-hl-rect[data-hl="pink"]  { background: var(--hl-pink);   }
    .lia-hl-rect[data-hl="orange"]{ background: var(--hl-orange); }
    .lia-hl-rect[data-hl="red"]   { background: var(--hl-red);    }
  `),u(e,"lia-hl-style-root-v4",`
      :root{
      --hl-ui-bg: rgba(255,255,255,.92);
      --hl-ui-fg: rgba(0,0,0,.88);
      --hl-ui-border: rgba(0,0,0,.14);
      --hl-ui-muted: rgba(0,0,0,.62);
      --hl-ui-shadow: 0 16px 42px rgba(0,0,0,.16);

      --hl-accent: rgb(11,95,255);
      --hl-z: 9999999;
      }


    #lia-hl-ui-overlay-v1{
      position: fixed !important;
      z-index: var(--hl-z) !important;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      pointer-events: none !important;
    }

    #lia-hl-inline-slot-v1{
      position: relative !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;

      width: 40px !important;
      min-width: 40px !important;
      max-width: 40px !important;

      height: 40px !important;
      min-height: 40px !important;

      flex: 0 0 40px !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      pointer-events: none !important;
    }

    #lia-hl-inline-slot-v1 > #lia-hl-btn{
      position: relative !important;
      left: auto !important;
      top: auto !important;
      margin: 0 !important;
    }

    body.lia-hl-navstack #lia-toolbar-nav .lia-header__left{
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      justify-content: flex-start !important;

      width: 32px !important;
      min-width: 32px !important;

      gap: 6px !important;
      overflow: visible !important;
    }

    body.lia-hl-navstack #lia-hl-inline-slot-v1{
      width: 32px !important;
      min-width: 32px !important;
      max-width: 32px !important;

      height: 32px !important;
      min-height: 32px !important;

      flex: 0 0 32px !important;
    }


    #lia-hl-btn{
      position: absolute !important;
      pointer-events: auto !important;

      width: 40px !important;
      height: 40px !important;
      padding: 0 !important;
      margin: 0 !important;

      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;

      border: 0 !important;
      background: transparent !important;
      color: var(--hl-accent) !important;

      cursor: pointer !important;
      user-select: none !important;
      border-radius: 10px !important;
    }

    #lia-hl-btn:hover{
      background: color-mix(in srgb, currentColor 10%, transparent) !important;
    }
    #lia-hl-btn:active{
      background: color-mix(in srgb, currentColor 16%, transparent) !important;
    }

#lia-hl-btn .icon,
#lia-hl-btn svg{
  width:22px !important;
  height:22px !important;
  display:block !important;
  color: var(--hl-accent) !important;
}

#lia-hl-btn svg,
#lia-hl-btn svg *{
  color: var(--hl-accent) !important;
  stroke: var(--hl-accent) !important;
}

#lia-hl-btn svg path{
  stroke: var(--hl-accent) !important;
}

    #lia-hl-btn .dot{
      position: absolute !important;
      right: 6px !important;
      bottom: 6px !important;
      width: 10px !important;
      height: 10px !important;
      border-radius: 999px !important;
      border: 1px solid var(--hl-ui-border) !important;
      background: var(--hl-yellow) !important;
    }


    #lia-hl-panel{
      position: fixed !important;
      z-index: var(--hl-z) !important;

      width: 130px !important;
      display: none !important;

      border-radius: 18px !important;
      border: 1px solid var(--hl-ui-border) !important;
      background-color: var(--hl-ui-bg) !important;
      box-shadow: var(--hl-ui-shadow) !important;
      overflow: hidden !important;
      backdrop-filter: blur(6px);
    }


    /* Nightly: "Navigation"-Iconleiste (sehr kompakt / vertikal) */
    body.lia-hl-navstack #lia-hl-btn{
      margin: 0 !important;
      width: 22px !important;
      height: 22px !important;
      border-radius: 8px !important;
    }
    
    body.lia-hl-navstack #lia-hl-btn .icon{
      width: 15px !important;
      height: 15px !important;
    }
    
    body.lia-hl-navstack #lia-hl-btn .dot{
      right: 2px !important;
      bottom: 2px !important;
      width: 6px !important;
      height: 6px !important;
    }
    

    /* Focus-Ring komplett aus (Nightly setzt gern eigene Linien/Outlines) */
    #lia-hl-btn:focus,
    #lia-hl-btn:focus-visible{
      outline: none !important;
      box-shadow: none !important;
    }

    /* Active-State: NUR inset -> nichts kann nach links "durchstreichen" */
    body.lia-hl-active #lia-hl-btn{
      outline: none !important;
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--hl-ui-fg) 25%, transparent) !important;
    }

    /* Nav-Stack: ebenfalls nur inset, etwas feiner */
    body.lia-hl-navstack.lia-hl-active #lia-hl-btn{
      outline: none !important;
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--hl-ui-fg) 22%, transparent) !important;
    }


    /* Nightly-UI: manche Header-Buttons bekommen Linien via ::after/::before oder border-bottom.
       Das killt exakt diese "Strich"-Artefakte nur f\xfcr unseren Button. */
    #lia-hl-btn,
    #lia-hl-btn *{
      text-decoration: none !important;
    }

    #lia-hl-btn::before,
    #lia-hl-btn::after{
      content: none !important;
      display: none !important;
    }

    #lia-hl-btn{
      border: 0 !important;
      border-bottom: 0 !important;
      box-shadow: none !important;   /* falls Nightly hier was drauflegt */
      outline: none !important;
    }

    /* auch Focus/Focus-visible komplett neutralisieren */
    #lia-hl-btn:focus,
    #lia-hl-btn:focus-visible{
      outline: none !important;
      box-shadow: none !important;
    }


    body.lia-hl-panel-open #lia-hl-panel{ display:block !important; }

    #lia-hl-panel .hdr{
      display:flex !important;
      align-items:center !important;
      justify-content:space-between !important;
      gap: 10px !important;
      padding: 10px 12px !important;
      border-bottom: 1px solid color-mix(in srgb, var(--hl-ui-border) 85%, transparent) !important;
    }

    #lia-hl-panel .title{
      font-weight: 700 !important;
      font-size: 13px !important;
      color: var(--hl-ui-fg) !important;
    }

    #lia-hl-panel .body{
      padding: 12px !important;
      display: grid !important;
      gap: 12px !important;
    }

    .hl-tools{
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 10px !important;
    }

    .hl-tool{
      border: 1px solid var(--hl-ui-border) !important;
      background: color-mix(in srgb, var(--hl-ui-fg) 5%, transparent) !important;
      color: var(--hl-ui-fg) !important;

      border-radius: 14px !important;
      padding: 10px 10px !important;
      cursor: pointer !important;
      font-size: 13px !important;

      display:flex !important;
      align-items:center !important;
      justify-content:center !important;

      user-select:none !important;
    }

    .hl-tool.active{
      background: color-mix(in srgb, var(--hl-ui-fg) 16%, transparent) !important;
      border-color: color-mix(in srgb, var(--hl-ui-fg) 22%, var(--hl-ui-border)) !important;
    }

.hl-tool svg{
  display: block !important;
  flex: 0 0 auto !important;
}

/* Stift: etwas kleiner/feiner */
#hl-tool-mark svg{
  width: 26px !important;
  height: 26px !important;
}

/* Radierer: etwas gr\xf6\xdfer, weil massiver Pfad */
#hl-tool-erase svg{
  width: 26px !important;
  height: 26px !important;
}

/* Stift bleibt Linien-Icon */
#hl-tool-mark svg *{
  stroke: currentColor !important;
  fill: none !important;
}

/* Radierer bleibt Fl\xe4chen-Icon */
#hl-tool-erase svg *{
  fill: currentColor !important;
  stroke: none !important;
}

    .hl-colors{
      display:flex !important;
      flex-wrap: wrap !important;
      gap: 10px !important;
    }

    .hl-swatch{
      width: 28px !important;
      height: 28px !important;
      border-radius: 999px !important;
      border: 2px solid var(--hl-ui-border) !important;
      cursor: pointer !important;
      box-shadow: 0 8px 16px color-mix(in srgb, var(--hl-ui-fg) 18%, transparent) !important;
    }

    .hl-swatch.active{
      outline: 3px solid color-mix(in srgb, var(--hl-ui-fg) 65%, transparent) !important;
      outline-offset: 2px !important;
    }

    .hl-clear{
      width: 100% !important;
      border: 1px solid color-mix(in srgb, rgba(200,0,0,.9) 25%, var(--hl-ui-border)) !important;
      background: rgba(200,0,0,.06) !important;
      border-radius: 14px !important;
      padding: 10px 10px !important;
      cursor: pointer !important;
      font-size: 12px !important;
      color: var(--hl-ui-fg) !important;
    }



    /* Lia-Quiz im Proxy kapseln: alles verstecken au\xdfer Buttons */
    .hlq-proxy .hlq-lia{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 0 !important;          /* killt "The correct answer ..." zuverl\xe4ssig */
    }
    
    /* Buttons wieder lesbar machen */
    .hlq-proxy .hlq-lia button,
    .hlq-proxy .hlq-lia [role="button"],
    .hlq-proxy .hlq-lia a{
      font-size: 1rem !important;
    }
    
    /* Eingabefelder sicher aus */
    .hlq-proxy .hlq-lia input,
    .hlq-proxy .hlq-lia textarea,
    .hlq-proxy .hlq-lia select{
      display: none !important;
    }

    /* Textmarker-Quiz Buttons (eigene UI, Lia-Quiz raus) */
    .hlq-btn{
      appearance: none;
      border: 1px solid var(--hl-ui-border);
      background: color-mix(in srgb, var(--hl-ui-fg) 6%, transparent);
      color: var(--hl-ui-fg);
      border-radius: 12px;
      padding: 8px 10px;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
    }

    .hlq-btn:hover{
      border-color: color-mix(in srgb, var(--hl-accent) 45%, var(--hl-ui-border));
      background: color-mix(in srgb, var(--hl-accent) 10%, transparent);
    }

    .hlq-btn:active{
      background: color-mix(in srgb, var(--hl-accent) 14%, transparent);
    }

    .hlq-proxy .hlq-msg{
      margin-right: 6px;
    }


/* ---------------------------------------------------------
   HLQ: Standard = unsichtbar (Prod), Debug = sichtbar
   --------------------------------------------------------- */

/* Default: Proxy-Buttons + Status-Text ausblenden */
.hlq-proxy .hlq-btn,
.hlq-proxy .hlq-msg{
  display: none !important;
}

/* Debug: wieder einblenden */
body.lia-hlq-debug .hlq-proxy .hlq-btn{
  display: inline-flex !important;
}
body.lia-hlq-debug .hlq-proxy .hlq-msg{
  display: inline !important;
}



  `);let y=n.getElementById("lia-hl-overlay");function b(){let t=function(){let t=n.querySelector("main")||n.body;for(let e=0;e<10&&t&&t!==n.body;e++){if(function(t){if(!t||t===n.body||t===n.documentElement)return!1;let e=r.getComputedStyle(t),l=(e.overflowY||"").toLowerCase(),i=(e.overflowX||"").toLowerCase(),o=("auto"===l||"scroll"===l||"overlay"===l)&&t.scrollHeight>t.clientHeight+2,a=("auto"===i||"scroll"===i||"overlay"===i)&&t.scrollWidth>t.clientWidth+2;return o||a}(t))return t;t=t.parentElement}return null}();if(t){let e=t.getBoundingClientRect();return{host:t,sx:t.scrollLeft||0,sy:t.scrollTop||0,ox:e.left,oy:e.top}}return{host:null,sx:r.scrollX||0,sy:r.scrollY||0,ox:0,oy:0}}function v(t){let e=n.body,r=[],l=t;for(;l&&l!==e;){let t=l.parentNode;if(!t)break;let e=Array.prototype.indexOf.call(t.childNodes,l);r.push(e),l=t}return r.reverse(),r.join("/")}function x(t){let e=n.body;if(!t)return null;let r=t.split("/").filter(Boolean).map(t=>parseInt(t,10)),l=e;for(let t of r){if(!l||!l.childNodes||t<0||t>=l.childNodes.length)return null;l=l.childNodes[t]}return l||null}function w(t,e){return t?3===t.nodeType?Math.max(0,Math.min(e,(t.nodeValue||"").length)):1===t.nodeType?Math.max(0,Math.min(e,t.childNodes?t.childNodes.length:0)):0:0}function k(t){if(!t)return null;let e=x(t.sp),r=x(t.ep);if(!e||!r)return null;let l=n.createRange(),i=w(e,t.so),o=w(r,t.eo);try{if(l.setStart(e,i),l.setEnd(r,o),l.collapsed)return null;return l}catch(t){return null}}function S(t){let e=Array.from(t.getClientRects?t.getClientRects():[]);if(!e.length)return[];let r=b(),n=e.filter(t=>t.width>.5&&t.height>.5).map(t=>({x:t.left-r.ox+r.sx,y:t.top-r.oy+r.sy,w:t.width,h:t.height}));return n.length?E(n,{yTol:4,gapTol:10,minW:2,minH:2,padX:0,padY:0}):[]}function E(t,e){let r=e?.yTol??4,n=e?.gapTol??10,l=e?.minW??2,i=e?.minH??2,o=e?.padX??0,a=e?.padY??0,s=t.slice().sort((t,e)=>t.y-e.y||t.x-e.x),c=[];for(let t of s){let e=t.y+t.h/2,n=null;for(let t=c.length-1;t>=0;t--){let l=c[t];if(Math.abs(e-l.cy)<=r){n=l;break}if(e<l.cy-2*r)break}n||(n={cy:e,rects:[]},c.push(n)),n.rects.push(t),n.cy=(n.cy*(n.rects.length-1)+e)/n.rects.length}let u=[];for(let t of c){let e=t.rects.sort((t,e)=>t.x-e.x),r=null;for(let t of e){let e=t.x,s=t.x+t.w,c=t.y,d=t.y+t.h;if(!r){r={x1:e,x2:s,y1:c,y2:d};continue}if(e<=r.x2+n)r.x2=Math.max(r.x2,s),r.y1=Math.min(r.y1,c),r.y2=Math.max(r.y2,d);else{let t=r.x2-r.x1,n=r.y2-r.y1;t>=l&&n>=i&&u.push({x:r.x1-o,y:r.y1-a,w:t+2*o,h:n+2*a}),r={x1:e,x2:s,y1:c,y2:d}}}if(r){let t=r.x2-r.x1,e=r.y2-r.y1;t>=l&&e>=i&&u.push({x:r.x1-o,y:r.y1-a,w:t+2*o,h:e+2*a})}}return u}function q(){let l=n.querySelector("main")||n.body,i=r.getComputedStyle(l),o=r.getComputedStyle(n.documentElement),a=(e.documentElement.className||"")+"|"+(e.body.className||""),s=(n.documentElement.className||"")+"|"+(n.body.className||""),c=e.documentElement,u=e.body,d=(c?.getAttribute("data-mode")||"")+"|"+(c?.getAttribute("data-view")||"")+"|"+(c?.getAttribute("data-layout")||"")+"|"+(u?.getAttribute("data-mode")||"")+"|"+(u?.getAttribute("data-view")||"")+"|"+(u?.getAttribute("data-layout")||""),h=n.documentElement,p=n.body,m=(h?.getAttribute("data-mode")||"")+"|"+(h?.getAttribute("data-view")||"")+"|"+(h?.getAttribute("data-layout")||"")+"|"+(p?.getAttribute("data-mode")||"")+"|"+(p?.getAttribute("data-view")||"")+"|"+(p?.getAttribute("data-layout")||""),f=l.getBoundingClientRect(),g=[f.left,f.top,f.width].map(t=>Math.round(t)).join(","),y=e.querySelector("header#lia-toolbar-nav")||e.querySelector("#lia-toolbar-nav")||e.querySelector("header.lia-header"),b="nohdr";if(y){let t=y.getBoundingClientRect();b=[t.left,t.top,t.width,t.height].map(t=>Math.round(t)).join(",")}let v=t.visualViewport,x=v?[v.width,v.height,v.offsetLeft||0,v.offsetTop||0].map(t=>Math.round(t)).join(","):[e.documentElement.clientWidth||0,e.documentElement.clientHeight||0,0,0].map(t=>Math.round(t)).join(",");return[o.fontSize,i.fontSize,i.lineHeight,i.width,i.paddingLeft,i.paddingRight,a,s,d,m,g,b,x].join("§")}function L(){for(let t of s.HL){if(!t.anchor)continue;let e=k(t.anchor);if(!e){t.rects=[];continue}t.rects=S(e)||[]}}function A(){let t=q();t!==s.__layoutSig&&(s.__layoutSig=t,L(),C())}function _(){let e=(t.location.hash||r.location.hash||"").trim();return e&&e.startsWith("#/")?e:null}function C(){y.innerHTML="";let t=Y(),e=t?tt():null;if(t&&!e)return;for(let t of(s.__activeSlide=e||null,s.HL))te(t);let r=t&&e?s.HL.filter(t=>(t.slide||"global")===e):s.HL,l=b();for(let t of r)for(let e of t.rects){let r=n.createElement("div");r.className="lia-hl-rect",r.setAttribute("data-hl",t.color),r.setAttribute("data-id",String(t.id)),r.setAttribute("data-kind",t.kind||"user"),r.style.left=`${Math.round(l.ox+(e.x-l.sx))}px`,r.style.top=`${Math.round(l.oy+(e.y-l.sy))}px`,r.style.width=`${Math.round(e.w)}px`,r.style.height=`${Math.round(e.h)}px`,y.appendChild(r)}}y||((y=n.createElement("div")).id="lia-hl-overlay",n.body.appendChild(y)),s.__layoutSig="";let M=!1;function T(){M||(M=!0,t.requestAnimationFrame(()=>{M=!1,s.__alive&&C()}))}function N(){let t=e.querySelector("header#lia-toolbar-nav")||e.querySelector("#lia-toolbar-nav");return t&&t.querySelector(".lia-header__left")||null}function O(t){if(!t)return null;let e=Array.from(t.querySelectorAll("button,[role='button'],a"));return e.length?e.find(t=>{let e=((t.getAttribute("aria-label")||t.getAttribute("title")||t.textContent||"")+"").toLowerCase();return e.includes("inhaltsverzeichnis")||e.includes("table of contents")||e.includes("contents")})||e[0]:null}function H(){let t=e.getElementById(c);return t||((t=e.createElement("div")).id=c,e.body.appendChild(t)),t}function I(){let t=e.querySelector(".lia-canvas");if(!t)return!1;let r=t.classList.contains("lia-navigation--hidden"),n=t.classList.contains("lia-mode--presentation");return r&&n}function B(){let t=e.getElementById("lia-hl-btn"),r=H();if(!t||!r)return;t.parentNode!==r&&r.appendChild(t);let n=e.getElementById("lia-hl-inline-slot-v1");n&&n.parentNode&&n.parentNode.removeChild(n),r.style.left="0px",r.style.top="0px",t.style.left="",t.style.top=""}function R(){e.body.classList.toggle("lia-hl-navstack",!!I()),function(){let r=e.getElementById("lia-hl-btn"),n=H();if(!r||!n)return;B();let l=W(),i=40,o=40;try{let t=r.getBoundingClientRect();t&&t.width>6&&t.height>6&&(i=t.width,o=t.height)}catch(t){}let a=8,s=8,c=function(){let t=e.getElementById("lia-btn-toc")||O(N());if(!t)return null;try{let e=t.getBoundingClientRect();if(!e||e.width<6||e.height<6)return null;return e}catch(t){return null}}()||null;if(c)if(I()){let r=function(){let r=0;for(let n of["lia-tff-btn-v2","lia-hl-btn"]){if("lia-hl-btn"===n)break;(function(e){if(!e)return!1;try{let r=t.getComputedStyle(e);if(!r||"none"===r.display||"hidden"===r.visibility||"0"===r.opacity)return!1;let n=e.getBoundingClientRect();return!!(n&&n.width>4&&n.height>4)}catch(t){return!1}})(e.getElementById(n))&&r++}return r}();a=c.left+(c.width-i)/2,s=c.bottom+6+28*r}else a=c.right+8,s=c.top+(c.height-o)/2;else{let t=N(),e=t?t.getBoundingClientRect():null;e&&(a=e.left+8,s=e.top+8)}a=P(a,8,l.w-i-8),s=P(s,8,l.h-o-8),n.style.left=`${Math.round(l.ox)}px`,n.style.top=`${Math.round(l.oy)}px`,r.style.left=`${Math.round(a)}px`,r.style.top=`${Math.round(s)}px`}(),D()}function z(){try{for(s.posTimers||(s.posTimers=[]);s.posTimers.length;)t.clearTimeout(s.posTimers.pop())}catch(t){}for(let e of(R(),t.requestAnimationFrame(()=>{t.requestAnimationFrame(()=>{R()})}),[10,20,30]))s.posTimers.push(t.setTimeout(()=>{R()},e))}function $(){let t=Date.now();t-(s.lastBurstAt||0)<80||(s.lastBurstAt=t,z())}function P(t,e,r){return Math.max(e,Math.min(r,t))}function W(){let r=t.visualViewport;if(r)return{w:r.width,h:r.height,ox:r.offsetLeft||0,oy:r.offsetTop||0};let n=e.documentElement;return{w:n.clientWidth,h:n.clientHeight,ox:0,oy:0}}function D(){let t,r,n,l,i,o,a=e.getElementById("lia-hl-btn"),c=e.getElementById("lia-hl-panel");if(!a||!c||!(s.state.active&&s.state.panelOpen))return;let u=a.getBoundingClientRect(),d=W(),h=(t=c.style.display,r=c.style.visibility,n=c.style.left,l=c.style.top,c.style.display="block",c.style.visibility="hidden",c.style.left="-9999px",c.style.top="-9999px",i=c.offsetWidth||130,o=c.offsetHeight||180,c.style.display=t,c.style.visibility=r,c.style.left=n,c.style.top=l,{w:i,h:o}),p=u.left,m=u.bottom+10;p=P(p,8,d.w-h.w-8),m+h.h+8>d.h&&(m=u.top-10-h.h),m=P(m,8,d.h-h.h-8),p+=d.ox,m+=d.oy,c.style.left=`${Math.round(p)}px`,c.style.top=`${Math.round(m)}px`}function F(){try{e.body.classList.toggle("lia-hl-active",!!s.state.active),e.body.classList.toggle("lia-hl-panel-open",!!(s.state.active&&s.state.panelOpen))}catch(t){}try{n.body.classList.toggle("lia-hlq-debug",!!s.debugHLQ)}catch(t){}let r=e.getElementById("hl-tool-mark"),l=e.getElementById("hl-tool-erase");r&&r.classList.toggle("active","mark"===s.state.tool),l&&l.classList.toggle("active","erase"===s.state.tool);let i=e.getElementById("lia-hl-dot");if(i){let t={yellow:getComputedStyle(n.documentElement).getPropertyValue("--hl-yellow").trim(),green:getComputedStyle(n.documentElement).getPropertyValue("--hl-green").trim(),blue:getComputedStyle(n.documentElement).getPropertyValue("--hl-blue").trim(),pink:getComputedStyle(n.documentElement).getPropertyValue("--hl-pink").trim(),orange:getComputedStyle(n.documentElement).getPropertyValue("--hl-orange").trim(),red:getComputedStyle(n.documentElement).getPropertyValue("--hl-red").trim()};i.style.setProperty("background",t[s.state.color]||t.yellow,"important")}let o=e.getElementById("hl-colors");o&&Array.from(o.querySelectorAll(".hl-swatch")).forEach(t=>{t.classList.toggle("active",t.getAttribute("data-hl")===s.state.color)}),s.state.active&&s.state.panelOpen&&t.requestAnimationFrame(()=>D())}function V(){if(s.moSlides)return;let t=j();t&&(s.moSlides=new r.MutationObserver(()=>{tr(!0)}),s.moSlides.observe(t,{subtree:!0,attributes:!0,attributeFilter:["class","style","aria-hidden"],childList:!0}))}function j(){return n.querySelector(".reveal .slides")||null}function Q(){let t=j();if(t)return Array.from(t.querySelectorAll("section")).filter((t,e,r)=>r.indexOf(t)===e);let e=n.querySelector("main")||n.body,r=Array.from(e.querySelectorAll("section[aria-hidden], section[data-index], section[data-slide], section.lia-slide, section.lia-section"));return r.length||(r=Array.from(e.querySelectorAll("section"))),r.length||(r=Array.from(e.children).filter(t=>t&&("SECTION"===t.tagName||"ARTICLE"===t.tagName))),r.filter((t,e,r)=>r.indexOf(t)===e)}function U(){let t=Q();for(let e=0;e<t.length;e++){let r=t[e];r.dataset.hlSlide||(r.dataset.hlSlide="F"+(e+1))}}function X(t){U();let e=t&&1===t.nodeType?t:t?.parentElement;return e?.closest?.("[data-hl-slide]")||null}function K(t){let e=X(t);return e?.dataset?.hlSlide||"global"}function Y(){return!!j()||!(Q().length<2)&&(!!(e.documentElement.getAttribute("data-view")||e.body.getAttribute("data-view")||"").toLowerCase().includes("presentation")||((e.body.className||"").toLowerCase().includes("presentation"),!0))}function G(){let t=r.innerWidth||n.documentElement.clientWidth||0,e=r.innerHeight||n.documentElement.clientHeight||0;return{left:0,top:0,right:t,bottom:e,w:t,h:e}}function J(t,e){let r=Math.max(t.left,e.left),n=Math.max(t.top,e.top),l=Math.min(t.right,e.right),i=Math.min(t.bottom,e.bottom),o=l-r,a=i-n;return o>0&&a>0?o*a:0}function Z(){U();let t=j();if(t){let e=Array.from(t.querySelectorAll("section.present"));if(e.length)return e[e.length-1]}let e=Q();if(!e.length)return null;let n=e.find(t=>t.classList.contains("present")||t.classList.contains("active")||t.classList.contains("current")||"false"===t.getAttribute("aria-hidden")||"true"===t.dataset.active);if(n)return n;let l=G(),i=null,o=-1;for(let t of e){let e=r.getComputedStyle(t);if("true"===t.getAttribute("aria-hidden")||.01>parseFloat(e.opacity||"1")||"none"===e.display||"hidden"===e.visibility)continue;let n=t.getBoundingClientRect(),a=J(n,l);a>o&&(o=a,i=t)}return i||e[0]}function tt(){let t=Z();return t?.dataset?.hlSlide||null}function te(t){if(t?.slide||!t?.anchor)return;let e=k(t.anchor);e&&(t.slide=K(e.commonAncestorContainer))}function tr(t=!1){if(!Y()){(null!==s.__activeSlide||t)&&(s.__activeSlide=null,C());return}let e=tt();(e!==s.__activeSlide||t)&&(s.__activeSlide=e||null,C())}function K(t){let e=_();if(e)return e;let r=X(t);return r?.dataset?.hlSlide||"global"}function Y(){if(_())return!0;let t=(e.documentElement.getAttribute("data-view")||e.body.getAttribute("data-view")||"").toLowerCase(),r=(e.body.className||"").toLowerCase();return!!(t.includes("presentation")||r.includes("presentation"))||Q().length>=2}function tt(){let t=_();if(t)return t;let e=Z();return e?.dataset?.hlSlide||null}function G(){let t=r.innerWidth||n.documentElement.clientWidth||0,e=r.innerHeight||n.documentElement.clientHeight||0;return{left:0,top:0,right:t,bottom:e,w:t,h:e}}function J(t,e){let r=Math.max(t.left,e.left),n=Math.max(t.top,e.top),l=Math.min(t.right,e.right),i=Math.min(t.bottom,e.bottom),o=l-r,a=i-n;return o>0&&a>0?o*a:0}function te(t){if(t?.slide||!t?.anchor)return;let e=k(t.anchor);e&&(t.slide=K(e.commonAncestorContainer))}function tn(){let t=Array.from(n.querySelectorAll(".markerquiz"));for(let e=0;e<t.length;e++){let r=t[e];r.dataset.hlScope||(r.dataset.hlScope="S"+(e+1))}}function tl(t){let e=t&&1===t.nodeType?t:t?.parentElement;return e?.closest?.(".markerquiz")||null}function ti(t){tn();let e=tl(t);return e&&e.dataset.hlScope?e.dataset.hlScope:"global"}function to(t){return(t||[]).reduce((t,e)=>t+Math.max(0,e.w)*Math.max(0,e.h),0)}function ta(t,e){let r=Math.max(t.x,e.x),n=Math.max(t.y,e.y),l=Math.min(t.x+t.w,e.x+e.w),i=Math.min(t.y+t.h,e.y+e.h),o=l-r,a=i-n;return o>0&&a>0?o*a:0}function ts(t){return Array.from((t||n).querySelectorAll(".lia-hl-target[data-hl-expected]")).map(t=>{let e=t.getAttribute("data-hl-expected")||"yellow",r=n.createRange();return r.selectNodeContents(t),{el:t,color:e,anchor:{sp:v(r.startContainer),so:r.startOffset,ep:v(r.endContainer),eo:r.endOffset}}})}function tc(t,e){return{x:t.x-e,y:t.y-e,w:t.w+2*e,h:t.h+2*e}}function tu(t,e){let r=0;for(let n of t||[])for(let t of e||[])r+=ta(n,t);return r}function td(t,e,r=2){let n=[],l=(e||[]).map(t=>tc(t,r));for(let e of t||[]){let t=!1;for(let r of l)if(ta(r,e)>0){t=!0;break}t&&n.push(e)}return n}function th(t){try{return"function"==typeof K&&K(t)||"global"}catch(t){}try{return"function"==typeof tt&&tt()||"global"}catch(t){}return"global"}function tp(t,e,r,n){let l=[],i={yTol:4,gapTol:12,minW:2,minH:2,padX:0,padY:0};for(let o of s.HL){if("user"!==(o.kind||"user")||(o.scope||"global")!==t||(o.slide||"global")!==e||"only"===r&&o.color!==n||"except"===r&&o.color===n)continue;let a=Array.isArray(o.rects)?o.rects:[];if(!a.length)continue;let s=E(a,i);l.push(...s)}return l}function tm(t,e){let r=t.querySelector(".hlq-msg");r&&(r.textContent=e||"")}function tf(t,e){if(t){try{t.value=String(e)}catch(t){return}for(let e of["input","change","keyup","blur"]){try{t.dispatchEvent(new Event(e,{bubbles:!0}))}catch(t){}try{t.dispatchEvent(new Event("keydown",{bubbles:!0}))}catch(t){}}}}function tg(t,e,r){let l=e.closest(".markerquiz")||tl(r),i=function(t){let e=t.querySelector(".hlq-lia input, .hlq-lia textarea, .hlq-lia select")||t.querySelector("input, textarea, select");if(e)return e;let r=t.closest?.(".markerquiz")||n,l=t.getBoundingClientRect(),i=null,o=1/0;for(let t of Array.from(r.querySelectorAll("input, textarea, select"))){let e=t.getBoundingClientRect(),r=Math.abs(e.top+e.height/2-(l.top+l.height/2)),n=10*r+Math.abs(e.left+e.width/2-(l.left+l.width/2));!(r>300)&&n<o&&(o=n,i=t)}return i}(e);if("check"===t){let t=function(t){tn();let e=t?.dataset?.hlScope||"global",r=th(t),n=ts(t);if(!n.length)return{ok:0,total:0,pass:!1,badColor:0,tooWide:0,extra:0};L();let l=[],i=0,o=0,a=0;for(let t of n){let n=k(t.anchor);if(!n)continue;let s=S(n);s?.length&&l.push(...s);let c=function(t,e,r,n){let l="any"===r||"*"===r||!r,i=td(l?tp(t,e,"all"):tp(t,e,"only",r),n,2),o=to(n),a=to(i),s=o>0&&a>0?tu(n,i):0,c=o>0?s/o:0,u=a>0?s/a:0;if(l)return{pass:c>=.95&&u>=.55,sGood:c,sBad:0,sPrec:u};let d=td(tp(t,e,"except",r),n,2),h=o>0?tu(n,d):0,p=o>0?h/o:0;return{pass:c>=.95&&u>=.55&&p<=.1,sGood:c,sBad:p,sPrec:u}}(e,r,t.color,s);c.sBad>.1&&o++,c.sPrec<.55&&a++,c.pass&&i++}let c=0,u=l.map(t=>tc(t,2));for(let t of s.HL){if("user"!==(t.kind||"user")||(t.scope||"global")!==e||(t.slide||"global")!==r||!Array.isArray(t.rects)||!t.rects.length)continue;let n=to(t.rects);if(n<=0)continue;let l=tu(u,t.rects);if(l<=0){c++;continue}let i=Math.max(0,n-l),o=i/n;i>80&&o>.22&&c++}let d=i===n.length&&0===o&&0===a&&0===c;return{ok:i,total:n.length,pass:d,badColor:o,tooWide:a,extra:c}}(l);tm(e,t.total?`Treffer: ${t.ok}/${t.total}`+(t.badColor?` \u{2014} falsche Farbe: ${t.badColor}`:"")+(t.tooWide?` \u{2014} zu gro\xdf: ${t.tooWide}`:"")+(t.extra?` \u{2014} extra: ${t.extra}`:""):"Keine Targets gefunden."),tf(i,+!!t.pass);return}if("solve"===t){!function(t){tn();let e=t?.dataset?.hlScope||"global",r=th(t);for(let n of(s.HL=s.HL.filter(t=>"solution"!==t.kind||(t.scope||"global")!==e||(t.slide||"global")!==r),ts(t))){let t=k(n.anchor);if(!t)continue;let l=S(t),i="any"===n.color?"yellow":n.color;s.HL.push({id:s.nextId++,kind:"solution",scope:e,slide:r,color:i,anchor:n.anchor,rects:l})}C()}(l),tm(e,"Lösung eingeblendet."),tf(i,1);return}}function ty(t){let e=t&&1===t.nodeType?t:t?.parentElement;return!!e&&!!e.closest("[data-hlq-ignore='1'],[data-lia-hlq-ignore='1'],[data-lia-canvas-ui='1'],.lia-tool-menu,.lia-undo-btn,.lia-redo-btn,.lia-color-btn,.lia-eraser-btn,.lia-rect-btn,.lia-bgmenu-btn,.lia-annot-btn,.lia-annot-toolbar,.lia-annot-menu,.lia-annot-panel")}function tb(t){let e=t&&1===t.nodeType?t:t?.parentElement;return!!e&&!!e.closest("input, textarea, select, button, a, code, pre, .hlq-proxy")}function tv(){return n.querySelector("section.present")||e.querySelector("section.present")||null}function tx(){if(d(),!s.__hashWired){s.__hashWired=!0;try{t.addEventListener("hashchange",()=>tr(!0))}catch(t){}try{r.addEventListener("hashchange",()=>tr(!0))}catch(t){}}s.ticking||(s.ticking=!0,t.requestAnimationFrame(()=>{try{let l,i,o;l=H(),(i=e.getElementById("lia-hl-btn"))||((i=e.createElement("button")).id="lia-hl-btn",i.type="button",i.setAttribute("aria-label","Textmarker"),i.innerHTML=`
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="dot" id="lia-hl-dot"></span>
    `,l.appendChild(i)),(o=e.getElementById("lia-hl-panel"))||((o=e.createElement("div")).id="lia-hl-panel",o.innerHTML=`
      <div class="hdr"><div class="title">Textmarker</div></div>
      <div class="body">
        <div class="hl-tools">
          <button class="hl-tool" id="hl-tool-mark" type="button" aria-label="Markieren" title="Markieren">
            <svg viewBox="0 0 512 512" aria-hidden="true">
              <g transform="translate(-15 -75) scale(25)">
                <path d="M4 20h4l10.2-10.2a2.2 2.2 0 0 0 0-3.1l-1.1-1.1a2.2 2.2 0 0 0-3.1 0L3.8 15.8 3 21z"
                      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M13.2 6.8l4 4"
                      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M3.5 20.5h5"
                      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </g>
            </svg>
          </button>

          <button class="hl-tool" id="hl-tool-erase" type="button" aria-label="Radierer">
            <svg viewBox="0 0 512 512" aria-hidden="true">
              <path fill="currentColor" d="M490.3,133.177l-99.5-99.6c-33-33-74-11.4-85.5,0l-287.6,287.7c-23.6,23.6-23.6,61.9,0,85.5l81.1,81.1c2.6,2.6,6.2,4.1,10,4.1h102.4c3.7,0,7.3-1.5,10-4.1l269.2-269.2C513.9,195.077,513.9,156.777,490.3,133.177zM205.3,463.777h-90.7l-77-77c-12.6-12.6-12.6-33,0-45.5l67.4-67.4l145.1,145.1L205.3,463.777zM470.4,198.677l-200.3,200.3L125,253.877l200.3-200.3c6.1-6.1,27-18.5,45.5,0l99.5,99.5C482.9,165.777,482.9,186.177,470.4,198.677z"/>
            </svg>
          </button>
        </div>
        <div>
          <div class="hl-hint" style="margin-bottom:8px;">Farbe</div>
          <div class="hl-colors" id="hl-colors"></div>
        </div>
        <button class="hl-clear" id="hl-clear" type="button">Alle Markierungen l\xf6schen</button>
      </div>
    `,e.body.appendChild(o)),B(),function(){if(s.__rootDelegated)return;s.__rootDelegated=!0;let t=0;function r(){let e=Date.now();if(!(e-t<250)){t=e;try{s.state.active=!s.state.active,s.state.panelOpen=s.state.active,s.state.tool="mark",F(),C()}catch(t){console.error("[HL] toggle failed",t),s.state.active=!1,s.state.panelOpen=!1,s.state.tool="mark";try{F()}catch(t){}}}}e.addEventListener("click",t=>{t.target?.closest?.("#lia-hl-btn")&&(t.preventDefault(),t.stopPropagation(),r())},!0),e.addEventListener("touchend",t=>{t.target?.closest?.("#lia-hl-btn")&&(t.preventDefault(),t.stopPropagation(),r())},{capture:!0,passive:!1}),e.addEventListener("keydown",t=>{if("Escape"===t.key&&s.state.active){s.state.active=!1,s.state.panelOpen=!1,s.state.tool="mark";try{F(),C()}catch(t){}}},!0)}(),R(),function(){if(!("ResizeObserver"in t))return;s.roLayout||(s.roLayout=new t.ResizeObserver(()=>{s.roPending||(s.roPending=!0,t.requestAnimationFrame(()=>{s.roPending=!1,!s.__alive||s.HL&&0!==s.HL.length&&(L(),C())}))}));let e=new Set,r=n.querySelector("main")||n.body;for(let t of(r&&e.add(r),n.querySelectorAll(".dynFlex, .flex-child").forEach(t=>e.add(t)),e))if(!s.roNodes.has(t)){try{s.roLayout.observe(t)}catch(t){}s.roNodes.add(t)}for(let t of Array.from(s.roNodes))if(!e.has(t)){try{s.roLayout.unobserve(t)}catch(t){}s.roNodes.delete(t)}}(),V(),A(),function(){let t=e.getElementById("hl-colors");if(!t||t.childElementCount)return;let r={yellow:getComputedStyle(n.documentElement).getPropertyValue("--hl-yellow").trim(),green:getComputedStyle(n.documentElement).getPropertyValue("--hl-green").trim(),blue:getComputedStyle(n.documentElement).getPropertyValue("--hl-blue").trim(),pink:getComputedStyle(n.documentElement).getPropertyValue("--hl-pink").trim(),orange:getComputedStyle(n.documentElement).getPropertyValue("--hl-orange").trim(),red:getComputedStyle(n.documentElement).getPropertyValue("--hl-red").trim()};["yellow","green","blue","pink","orange","red"].forEach(n=>{let l=e.createElement("button");l.type="button",l.className="hl-swatch",l.setAttribute("data-hl",n),l.style.background=r[n]||r.yellow,l.addEventListener("click",()=>{s.state.tool="mark",s.state.color=n,s.state.panelOpen=!1,F()}),t.appendChild(l)})}(),tr(),function(){let l=Array.from(((t.Reveal||r.Reveal||tv()||(t.location.hash||r.location.hash||"").startsWith("#/")||((e.documentElement.getAttribute("data-view")||"")+" "+(e.body.className||"")).toLowerCase().includes("presentation"))&&tv()||n).querySelectorAll(".lia-hl-prefill[data-hl-prefill]"));if(l.length){try{tn()}catch(t){}for(let t of l){let e=(t.getAttribute("data-hl-prefill")||"yellow").toLowerCase(),r=n.createRange();try{r.selectNodeContents(t)}catch(t){continue}let l={sp:v(r.startContainer),so:r.startOffset,ep:v(r.endContainer),eo:r.endOffset},i="global";try{i=ti(r.commonAncestorContainer)}catch(t){}let o="global";try{o="function"==typeof tt&&tt()||("function"==typeof K?K(r.commonAncestorContainer):"global")||"global"}catch(t){}let a=`P|${e}|${i}|${o}|${l.sp}|${l.so}|${l.ep}|${l.eo}`;if(s.__prefillKeys.has(a))continue;let c=[];try{c=S(r)||[]}catch(t){c=[]}s.HL.push({id:s.nextId++,kind:"prefill",scope:i,slide:o,color:e,anchor:l,rects:c}),s.__prefillKeys.add(a)}C()}}(),function(){let r=e.getElementById("lia-hl-btn");if(!r||r.__liaHLWired)return;if(r.__liaHLWired=!0,!s.__hlTOCWired){s.__hlTOCWired=!0,e.addEventListener("click",t=>{t.target?.closest?.("#lia-btn-toc")&&z()},!0);let t=e.getElementById("lia-toc");t&&(t.addEventListener("transitionrun",()=>$(),!0),t.addEventListener("transitionstart",()=>$(),!0),t.addEventListener("transitionend",()=>$(),!0))}r.addEventListener("click",()=>{s.state.active?(s.state.active=!1,s.state.panelOpen=!1):(s.state.active=!0,s.state.panelOpen=!0),s.state.tool="mark",F()}),r.addEventListener("contextmenu",t=>{t.preventDefault(),s.state.active&&(s.state.panelOpen=!s.state.panelOpen,F())});let n=e.getElementById("hl-tool-mark"),l=e.getElementById("hl-tool-erase"),i=e.getElementById("hl-clear");n&&n.addEventListener("click",()=>{s.state.tool="mark",s.state.panelOpen=!1,F()}),l&&l.addEventListener("click",()=>{s.state.tool="erase",s.state.panelOpen=!1,F()}),i&&i.addEventListener("click",()=>{for(let t of s.HL)te(t);let t=new Set(["user","solution"]);if(Y()){let e=tt();e?s.HL=s.HL.filter(r=>{let n=r.kind||"user";return(r.slide||"global")!==e||!t.has(n)}):s.HL=s.HL.filter(e=>!t.has(e.kind||"user"))}else s.HL=s.HL.filter(e=>!t.has(e.kind||"user"));C(),s.state.panelOpen=!1,s.state.tool="mark",F()}),e.addEventListener("keydown",t=>{"Escape"===t.key&&s.state.active&&(s.state.panelOpen=!1,s.state.tool="mark",F())}),t.addEventListener("resize",()=>{$()}),t.visualViewport&&(t.visualViewport.addEventListener("resize",()=>{$()}),t.visualViewport.addEventListener("scroll",()=>{$()}))}(),g(),F(),D()}finally{s.ticking=!1}}))}r.addEventListener("scroll",T,{passive:!0}),n.addEventListener("scroll",T,{passive:!0,capture:!0}),r.addEventListener("resize",()=>{g(),A(),C()}),n.addEventListener("click",t=>{let e,r=t.target?.closest?.("button,[role='button'],a,[role='link']");if(!r||ty(r)||!(!(!(e=r&&1===r.nodeType?r:r?.parentElement)||ty(e))&&e.closest(".hlq-proxy, .hlq-lia, .markerquiz")))return;let l=r.closest("button.hlq-btn[data-hlq-act]");if(l){let t=l.closest(".hlq-proxy");if(!t)return;let e=l.getAttribute("data-hlq-act");if(!e)return;tg(e,t,l);return}let i=function(t){let e=t?.closest?.("button,[role='button'],a,[role='link']")||t;if(!e)return null;let r=(e.getAttribute("aria-label")||e.getAttribute("title")||e.textContent||"").trim().toLowerCase(),n=Array.from(e.classList||[]).map(t=>String(t).toLowerCase());return n.includes("lia-quiz__check")?"check":n.includes("lia-quiz__resolve")?"solve":"prüfen"===r||"check"===r||r.startsWith("prüfen")?"check":"auflösen"===r||"lösung"===r||"solve"===r||"show solution"===r||r.startsWith("auflösen")||r.startsWith("lösung")?"solve":null}(r);if(!i)return;let o=function(t){let e=t.closest?.(".hlq-proxy");if(e)return e;let r=Array.from((t.closest?.(".markerquiz")||n).querySelectorAll(".hlq-proxy"));if(!r.length)return null;if(1===r.length)return r[0];for(let e=r.length-1;e>=0;e--){let n=r[e];if(n.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING)return n}return r[0]}(r);if(!o)return;let a=r.closest?.(".markerquiz"),s=o.closest?.(".markerquiz");a&&s&&a!==s||tg(i,o,r)},!0),n.addEventListener("mouseup",t=>{ty(t.target)||!s.state.active||(s.state.panelOpen&&(s.state.panelOpen=!1,F()),"mark"===s.state.tool&&function(){let t=r.getSelection?r.getSelection():null;if(!t||0===t.rangeCount)return;let e=t.getRangeAt(0);if(!e||e.collapsed||tb(e.startContainer)||tb(e.endContainer))return;tn();let l=ti(e.commonAncestorContainer),i=e.cloneRange();if(!function(t){let e;if(!t)return!1;let r=t=>" "===t||"	"===t||"\n"===t||"\r"===t||" "===t||" "===t||" "===t,l=1===t.commonAncestorContainer.nodeType?t.commonAncestorContainer:t.commonAncestorContainer.parentNode;if(!l)return!1;let i=n.createTreeWalker(l,NodeFilter.SHOW_TEXT,{acceptNode(e){try{return t.intersectsNode(e)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}catch(t){return NodeFilter.FILTER_REJECT}}}),o=[];for(;e=i.nextNode();){let r=e.nodeValue||"";if(!r.length)continue;let n=0,l=r.length;e===t.startContainer&&(n=t.startOffset),e===t.endContainer&&(l=t.endOffset),n=Math.max(0,Math.min(n,r.length)),(l=Math.max(0,Math.min(l,r.length)))<=n||o.push({node:e,s:n,e:l,text:r.slice(n,l)})}if(!o.length)return!1;let a=null,s=0;for(let t of o){let e=t.text,n=0;for(;n<e.length&&r(e[n]);)n++;if(n<e.length){a=t.node,s=t.s+n;break}}let c=null,u=0;for(let t=o.length-1;t>=0;t--){let e=o[t],n=e.text,l=n.length-1;for(;l>=0&&r(n[l]);)l--;if(l>=0){c=e.node,u=e.s+l+1;break}}if(!a||!c)return!1;try{return t.setStart(a,s),t.setEnd(c,u),!t.collapsed}catch(t){return!1}}(i)){try{t.removeAllRanges()}catch(t){}return}let o=S(i);if(!o.length){try{t.removeAllRanges()}catch(t){}return}let a={sp:v(i.startContainer),so:i.startOffset,ep:v(i.endContainer),eo:i.endOffset},c="function"==typeof tt&&tt()?tt():K(i.commonAncestorContainer);s.HL.push({id:s.nextId++,kind:"user",scope:l,slide:c,color:s.state.color,anchor:a,rects:o});try{t.removeAllRanges()}catch(t){}C()}())},!0),n.addEventListener("pointerdown",t=>{if(ty(t.target)||!s.state.active||"erase"!==s.state.tool)return;L();let e=function(t,e){let r=b(),n=t-r.ox+r.sx,l=e-r.oy+r.sy,i=Y()?tt():null;for(let t=s.HL.length-1;t>=0;t--){let e=s.HL[t];if(e&&"user"===(e.kind||"user")&&(!i||(e.slide||"global")===i)){for(let t of Array.isArray(e.rects)?e.rects:[])if(n>=t.x&&n<=t.x+t.w&&l>=t.y&&l<=t.y+t.h)return e}}return null}(t.clientX,t.clientY);e&&(s.HL=s.HL.filter(t=>t.id!==e.id),t.preventDefault(),t.stopPropagation(),C())},!0),s.__prefillKeys=s.__prefillKeys||new Set;try{s.moDock=new MutationObserver(()=>tx()),s.moDock.observe(e.body,{childList:!0,subtree:!0})}catch(t){}try{s.moTheme=new MutationObserver(()=>{g(),F(),R()}),s.moTheme.observe(e.documentElement,{attributes:!0,attributeFilter:["class","data-theme","data-mode","data-view","data-layout"]}),s.moTheme.observe(e.body,{attributes:!0,attributeFilter:["class","data-theme","data-mode","data-view","data-layout"]})}catch(t){}function j(){return n.querySelector(".reveal .slides")||e.querySelector(".reveal .slides")||null}function tw(){return t.Reveal||r.Reveal||null}function tt(){let e=tw();if(e&&"function"==typeof e.getIndices){let t=e.getIndices()||{};return`R:${t.h||0}/${t.v||0}/${t.f||0}`}let n=function(){let t=j();if(!t)return null;let e=Array.from(t.querySelectorAll("section.present")),r=e.length?e[e.length-1]:null;if(!r)return null;let n=r.getAttribute("data-index-h"),l=r.getAttribute("data-index-v"),i=r.getAttribute("data-index-f");if(null!==n)return`D:${n}/${l||0}/${i||0}`;let o=r;for(;o.parentElement&&"SECTION"===o.parentElement.tagName;)o=o.parentElement;let a=Math.max(0,Array.from(t.children).filter(t=>"SECTION"===t.tagName).indexOf(o)),s=0;return r!==o&&(s=Math.max(0,Array.from(o.children).filter(t=>"SECTION"===t.tagName).indexOf(r))),`D:${a}/${s}/0`}();if(n)return n;let l=t.location.hash||r.location.hash||"";return l.startsWith("#/")?`H:${l}`:null}function Y(){return!!j()||(Q?Q():[]).length>=2}function K(t){let e=tt();if(e)return e;try{let e=X?X(t):null;return e?.dataset?.hlSlide||"global"}catch(t){return"global"}}function te(t){if(t?.slide&&"global"!==t.slide)return;let e=tt();if(!t?.anchor){e&&(t.slide=e);return}let r=k(t.anchor);if(!r){e&&(t.slide=e);return}let n="global";try{n=K(r.commonAncestorContainer)}catch(t){}("global"===n||!n)&&e&&(n=e),t.slide=n||"global"}function V(){if(s.moSlides)return;let n=j();if(n&&(s.moSlides=new(n.ownerDocument===e?t:r).MutationObserver(()=>{tr(!0)}),s.moSlides.observe(n,{subtree:!0,attributes:!0,attributeFilter:["class","style","aria-hidden"],childList:!0}),!s.__revealEvt)){s.__revealEvt=!0;let e=tw();if(e&&"function"==typeof e.addEventListener){try{e.addEventListener("ready",()=>tr(!0))}catch(t){}try{e.addEventListener("slidechanged",()=>tr(!0))}catch(t){}try{e.addEventListener("fragmentshown",()=>tr(!0))}catch(t){}try{e.addEventListener("fragmenthidden",()=>tr(!0))}catch(t){}}try{t.addEventListener("hashchange",()=>tr(!0))}catch(t){}try{r.addEventListener("hashchange",()=>tr(!0))}catch(t){}}}function tk(){return e.querySelector("section.present")||n.querySelector("section.present")||null}function tw(){return t.Reveal||r.Reveal||null}function tS(){if(tw()||tk())return!0;let t=(e.documentElement.getAttribute("data-view")||e.body.getAttribute("data-view")||"").toLowerCase(),r=(e.body.className||"").toLowerCase();return!!(t.includes("presentation")||r.includes("presentation")||e.querySelector(".reveal")||n.querySelector(".reveal"))}function j(){return n.querySelector(".reveal .slides")||e.querySelector(".reveal .slides")||n.querySelector(".slides")||e.querySelector(".slides")||null}function tt(){let e=tw();if(e&&"function"==typeof e.getIndices){let t=e.getIndices()||{};return`R:${t.h||0}/${t.v||0}/${t.f||0}`}let n=tk();if(n){let t=n.getAttribute("data-index-h"),e=n.getAttribute("data-index-v"),r=n.getAttribute("data-index-f");if(null!==t)return`D:${t}/${e||0}/${r||0}`;let l=n;for(;l.parentElement&&"SECTION"===l.parentElement.tagName;)l=l.parentElement;let i=j(),o=Math.max(0,(i?Array.from(i.children).filter(t=>"SECTION"===t.tagName):Array.from((l.parentElement||{}).children||[]).filter(t=>"SECTION"===t.tagName)).indexOf(l)),a=0;return n!==l&&(a=Math.max(0,Array.from(l.children).filter(t=>"SECTION"===t.tagName).indexOf(n))),`D:${o}/${a}/0`}let l=t.location.hash||r.location.hash||"";return l.startsWith("#/")?`H:${l}`:null}function Y(){return!!tS()||Q().length>=2}function K(t){if(tS())return tt()||"global";try{let e=X(t);return e?.dataset?.hlSlide||"global"}catch(t){return"global"}}function te(t){if(t&&(!t.slide||"global"===t.slide)&&tS()){let e=tt();e&&t.anchor&&k(t.anchor)&&(t.slide=e)}}function V(){if(s.__revealEvt)return;s.__revealEvt=!0;let n=tw();if(n&&"function"==typeof n.addEventListener){try{n.addEventListener("ready",()=>tr(!0))}catch(t){}try{n.addEventListener("slidechanged",()=>tr(!0))}catch(t){}try{n.addEventListener("fragmentshown",()=>tr(!0))}catch(t){}try{n.addEventListener("fragmenthidden",()=>tr(!0))}catch(t){}}try{t.addEventListener("hashchange",()=>tr(!0))}catch(t){}try{r.addEventListener("hashchange",()=>tr(!0))}catch(t){}let l=j();if(l){s.moSlides=new(l.ownerDocument===e?t:r).MutationObserver(()=>tr(!0));try{s.moSlides.observe(l,{subtree:!0,attributes:!0,attributeFilter:["class","aria-hidden"],childList:!0})}catch(t){}}}function C(){y.innerHTML="";let t=Y(),e=t?tt():null;if(t&&!e)return;for(let t of(s.__activeSlide=e||null,s.HL))te(t);let r=t&&e?s.HL.filter(t=>t.slide&&"global"!==t.slide&&t.slide===e):s.HL,l=b();for(let e of r){if(t&&e.anchor){let t=k(e.anchor);if(!t)continue;let r=S(t);if(!r?.length)continue;e.rects=r}for(let t of e.rects||[]){let r=n.createElement("div");r.className="lia-hl-rect",r.setAttribute("data-hl",e.color),r.setAttribute("data-id",String(e.id)),r.setAttribute("data-kind",e.kind||"user"),r.style.left=`${Math.round(l.ox+(t.x-l.sx))}px`,r.style.top=`${Math.round(l.oy+(t.y-l.sy))}px`,r.style.width=`${Math.round(t.w)}px`,r.style.height=`${Math.round(t.h)}px`,y.appendChild(r)}}}tx(),C(),s.__layoutTimer||(s.__layoutSig=q(),s.__layoutTimer=t.setInterval(()=>{s.__alive&&(A(),tr())},350)),!function(){function l(){}function i(){let t=n.querySelector(".reveal .slides")||e.querySelector(".reveal .slides")||n.querySelector(".slides")||e.querySelector(".slides")||null,r=[];if(t)r=Array.from(t.querySelectorAll("section"));else{let t=n.querySelector("main")||n.body;(r=Array.from(t.querySelectorAll("section"))).length||(r=Array.from(t.children).filter(t=>t&&("SECTION"===t.tagName||"ARTICLE"===t.tagName)))}return r.filter((t,e,r)=>r.indexOf(t)===e)}function o(){let t=i(),e=1;for(let r of t)r.dataset.hlSlideid||(r.dataset.hlSlideid="SLIDE_"+e++)}function a(){let e=function(){let e,l;o();try{{let t=Z();if(t)return t}}catch(t){}try{let e=r.Reveal||t.Reveal||null;if(e&&"function"==typeof e.getCurrentSlide){let t=e.getCurrentSlide();if(t)return t}}catch(t){}let a=Array.from(n.querySelectorAll("section.present")).filter((t,e,r)=>r.indexOf(t)===e);if(a.length){let t=a.filter(t=>!a.some(e=>e!==t&&t.contains(e)));return t.length?t[t.length-1]:a[a.length-1]}let s=i();if(!s.length)return null;let c=(e=r.innerWidth||n.documentElement.clientWidth||0,{left:0,top:0,right:e,bottom:l=r.innerHeight||n.documentElement.clientHeight||0,w:e,h:l}),u=null,d=-1;for(let t of s){let e=r.getComputedStyle(t);if("none"===e.display||"hidden"===e.visibility||.01>parseFloat(e.opacity||"1")||"true"===t.getAttribute("aria-hidden"))continue;let n=function(t,e){let r=Math.max(t.left,e.left),n=Math.max(t.top,e.top),l=Math.min(t.right,e.right),i=Math.min(t.bottom,e.bottom),o=l-r,a=i-n;return o>0&&a>0?o*a:0}(t.getBoundingClientRect(),c);n>d&&(d=n,u=t)}return u||s[0]||null}();return e?.dataset?.hlSlideid||null}function c(){return i().length>=2}function u(t){let e,r=(o(),(e=t&&1===t.nodeType?t:t?.parentElement)&&e.closest?.("[data-hl-slideid]")||null);return r?.dataset?.hlSlideid||"global"}function d(){y.innerHTML="",o();let t=c(),e=t?a():null;if(l("render:start",{filter:t,activeId:e,slides:i().map(t=>t.dataset.hlSlideid),total:(s.HL||[]).length}),t&&!e){s.__activeSlide=null,l("render:no-active-slide");return}s.__activeSlide=e||null;let r=b();for(let i of s.HL||[]){if(!i||!i.anchor)continue;let o=k(i.anchor);if(!o){l("item:range-null",{id:i.id,stored:i.slide,kind:i.kind});continue}let a=u(o.commonAncestorContainer);if(a&&(i.slide=a),l("item:check",{id:i.id,kind:i.kind,stored:i.slide,live:a,active:e}),t&&a!==e)continue;let s=S(o);if(!s?.length){l("item:packed-empty",{id:i.id,stored:i.slide,live:a,active:e});continue}i.rects=s;for(let t of i.rects||[]){let e=n.createElement("div");e.className="lia-hl-rect",e.setAttribute("data-hl",i.color),e.setAttribute("data-id",String(i.id)),e.setAttribute("data-kind",i.kind||"user"),e.style.left=`${Math.round(r.ox+(t.x-r.sx))}px`,e.style.top=`${Math.round(r.oy+(t.y-r.sy))}px`,e.style.width=`${Math.round(t.w)}px`,e.style.height=`${Math.round(t.h)}px`,y.appendChild(e)}}l("render:end",{activeId:e,overlayChildren:y.childElementCount})}try{C=d}catch(t){}try{tt=a}catch(t){}try{K=u}catch(t){}try{Y=c}catch(t){}try{te=function(t){if(!t||t.slide&&"global"!==t.slide||!t.anchor)return;let e=k(t.anchor);if(!e)return;let r=u(e.commonAncestorContainer);r&&(t.slide=r)}}catch(t){}let h=0;function p(t){s.__alive&&(l("sync",{reason:t,activeBefore:s.__activeSlide,current:a()}),d())}function m(e){let r=++h;try{y.innerHTML=""}catch(t){}let n=()=>{s.__alive&&r===h&&p(e)};try{t.requestAnimationFrame(n)}catch(t){}setTimeout(n,1)}try{t.addEventListener("hashchange",()=>m("hashchange-root"))}catch(t){}try{r.addEventListener("hashchange",()=>m("hashchange-content"))}catch(t){}try{s.__slideSyncTimer&&t.clearInterval(s.__slideSyncTimer)}catch(t){}s.__slideSyncTimer=t.setInterval(()=>{if(!s.__alive){try{t.clearInterval(s.__slideSyncTimer)}catch(t){}return}let e=!!(s.HL&&s.HL.length);(s.state.active||e)&&p("timer")},10);try{t.__HLDBG={dump(){let t=a(),e=(s.HL||[]).map(e=>{let r=!1,n=null,l=0;if(e?.anchor){let t=k(e.anchor);if(t){r=!0,n=u(t.commonAncestorContainer);let e=S(t);l=e?.length||0}}return{id:e?.id,kind:e?.kind,stored:e?.slide,live:n,rangeOk:r,packed:l,active:t}});return console.log("[HLDBG dump]",{active:t,slides:i().map(t=>({id:t.dataset.hlSlideid,text:(t.textContent||"").trim().slice(0,60)})),rows:e}),e}}}catch(t){}m("initial")}()}()},{}]},["8RSWf"],"8RSWf","parcelRequire5c95",{});
//# sourceMappingURL=index.js.map
