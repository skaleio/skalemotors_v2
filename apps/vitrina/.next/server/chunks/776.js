exports.id=776,exports.ids=[776],exports.modules={6361:()=>{},7941:(e,r,a)=>{Promise.resolve().then(a.t.bind(a,2994,23)),Promise.resolve().then(a.t.bind(a,6114,23)),Promise.resolve().then(a.t.bind(a,9727,23)),Promise.resolve().then(a.t.bind(a,9671,23)),Promise.resolve().then(a.t.bind(a,1868,23)),Promise.resolve().then(a.t.bind(a,4759,23))},5303:()=>{},5283:(e,r,a)=>{"use strict";a.d(r,{SiteThemeProvider:()=>i});var o=a(326);a(7577);var t=a(6351);let s=`
@keyframes smFadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes smFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes smZoomIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes smFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes smGlowPulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.9; }
}
@keyframes smScrollCue {
  0% { transform: translateY(0); opacity: 0.9; }
  50% { transform: translateY(7px); opacity: 0.35; }
  100% { transform: translateY(0); opacity: 0.9; }
}
@keyframes smShine {
  0% { transform: translateX(-130%) skewX(-20deg); }
  100% { transform: translateX(230%) skewX(-20deg); }
}

.sm-fade-up { animation: smFadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
.sm-fade-in { animation: smFadeIn 0.8s ease both; }
.sm-zoom-in { animation: smZoomIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
.sm-d1 { animation-delay: 0.08s; }
.sm-d2 { animation-delay: 0.18s; }
.sm-d3 { animation-delay: 0.30s; }
.sm-d4 { animation-delay: 0.44s; }
.sm-d5 { animation-delay: 0.58s; }

.sm-glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  pointer-events: none;
  animation: smGlowPulse 6s ease-in-out infinite;
}

.sm-scroll-cue { animation: smScrollCue 1.8s ease-in-out infinite; }

.sm-card {
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.35s ease;
  will-change: transform;
}
.sm-card:hover {
  transform: translateY(-6px);
  border-color: color-mix(in srgb, var(--sm-primary) 55%, var(--sm-border)) !important;
  box-shadow: 0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, var(--sm-primary) 30%, transparent);
}
.sm-card img { transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
.sm-card:hover img { transform: scale(1.07); }

.sm-shine {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: inherit;
}
.sm-shine::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  transform: translateX(-130%) skewX(-20deg);
}
.sm-card:hover .sm-shine::after { animation: smShine 0.9s ease; }

.sm-cta {
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}
.sm-cta:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--sm-primary) 45%, transparent);
}

.sm-underline-grow {
  position: relative;
}

@media (prefers-reduced-motion: reduce) {
  .sm-fade-up, .sm-fade-in, .sm-zoom-in, .sm-glow, .sm-scroll-cue,
  .sm-card, .sm-card img, .sm-shine::after, .sm-cta {
    animation: none !important;
    transition: none !important;
  }
}
`;function i({site:e,children:r,className:a}){let i=(0,t.$E)(e),n=(0,t.Zo)(i);return(0,t.NW)(e),(0,o.jsxs)("div",{className:a,style:{...n,background:"var(--sm-bg)",color:"var(--sm-fg)",fontFamily:"var(--sm-font-body)"},children:[o.jsx("style",{dangerouslySetInnerHTML:{__html:s}}),r]})}},6351:(e,r,a)=>{"use strict";a.d(r,{$E:()=>f,NW:()=>p,Zo:()=>u});let o="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",t="Georgia, 'Times New Roman', serif",s={"poppins-inter":{label:"Poppins + Inter",heading:`'Poppins', ${o}`,body:`'Inter', ${o}`,googleFamilies:["Poppins:wght@500;600;700","Inter:wght@400;500;600"]},"playfair-lora":{label:"Playfair + Lora",heading:`'Playfair Display', ${t}`,body:`'Lora', ${t}`,googleFamilies:["Playfair+Display:wght@600;700","Lora:wght@400;500"]},"montserrat-roboto":{label:"Montserrat + Roboto",heading:`'Montserrat', ${o}`,body:`'Roboto', ${o}`,googleFamilies:["Montserrat:wght@600;700","Roboto:wght@400;500"]},"space-inter":{label:"Space Grotesk + Inter",heading:`'Space Grotesk', ${o}`,body:`'Inter', ${o}`,googleFamilies:["Space+Grotesk:wght@500;600;700","Inter:wght@400;500;600"]}},i={moderna:"poppins-inter",tradicional:"playfair-lora",premium:"montserrat-roboto",miami:"montserrat-roboto"},n={moderna:{colorBg:"#ffffff",colorSurface:"#f8fafc",colorFg:"#0f172a",colorMuted:"#64748b",colorPrimary:"#7c3aed",colorPrimaryFg:"#ffffff",colorSecondary:"#0ea5e9",colorBorder:"#e2e8f0",fontHeading:s["poppins-inter"].heading,fontBody:s["poppins-inter"].body,radius:"0.75rem",shadow:"0 1px 3px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.06)",spaceSection:"4rem"},tradicional:{colorBg:"#ffffff",colorSurface:"#faf7f2",colorFg:"#1c1917",colorMuted:"#78716c",colorPrimary:"#b45309",colorPrimaryFg:"#ffffff",colorSecondary:"#d9b382",colorBorder:"#e7e5e4",fontHeading:s["playfair-lora"].heading,fontBody:s["playfair-lora"].body,radius:"0.25rem",shadow:"0 1px 2px rgba(28,25,23,0.10)",spaceSection:"3.5rem"},premium:{colorBg:"#0b0b0f",colorSurface:"#15151c",colorFg:"#f5f5f7",colorMuted:"#a1a1aa",colorPrimary:"#c8a24a",colorPrimaryFg:"#0b0b0f",colorSecondary:"#f5f5f7",colorBorder:"#26262e",fontHeading:s["montserrat-roboto"].heading,fontBody:s["montserrat-roboto"].body,radius:"0.5rem",shadow:"0 10px 30px rgba(0,0,0,0.45)",spaceSection:"5rem"},miami:{colorBg:"#0a0a0a",colorSurface:"#141418",colorFg:"#ffffff",colorMuted:"#a1a1aa",colorPrimary:"#ec4899",colorPrimaryFg:"#ffffff",colorSecondary:"#f9a8d4",colorBorder:"#2a2a30",fontHeading:s["montserrat-roboto"].heading,fontBody:s["montserrat-roboto"].body,radius:"0.75rem",shadow:"0 16px 48px rgba(0,0,0,0.55)",spaceSection:"5rem"}};function l(e){return"moderna"===e||"tradicional"===e||"premium"===e||"miami"===e}function m(e){return"string"==typeof e&&e in s}function c(e){let r=/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(e.trim());if(!r)return null;let a=r[1];3===a.length&&(a=a.split("").map(e=>e+e).join(""));let o=parseInt(a,16);return{r:o>>16&255,g:o>>8&255,b:255&o}}function d(e){return"string"==typeof e&&e.trim().length>0}function f(e){let r=l(e?.theme)?e.theme:"moderna",a={...n[r]};d(e?.primary_color)&&c(e.primary_color)&&(a.colorPrimary=e.primary_color,a.colorPrimaryFg=function(e){let r=c(e);if(!r)return"#ffffff";let a=e=>{let r=e/255;return r<=.03928?r/12.92:Math.pow((r+.055)/1.055,2.4)};return .2126*a(r.r)+.7152*a(r.g)+.0722*a(r.b)>.179?"#000000":"#ffffff"}(e.primary_color)),d(e?.secondary_color)&&c(e.secondary_color)&&(a.colorSecondary=e.secondary_color);let o=m(e?.font)?e.font:i[r];return a.fontHeading=s[o].heading,a.fontBody=s[o].body,a}function p(e){let r=l(e?.theme)?e.theme:"moderna",a=s[m(e?.font)?e.font:i[r]].googleFamilies.map(e=>`family=${e}`).join("&");return`https://fonts.googleapis.com/css2?${a}&display=swap`}function u(e){return{"--sm-bg":e.colorBg,"--sm-surface":e.colorSurface,"--sm-fg":e.colorFg,"--sm-muted":e.colorMuted,"--sm-primary":e.colorPrimary,"--sm-primary-fg":e.colorPrimaryFg,"--sm-secondary":e.colorSecondary,"--sm-border":e.colorBorder,"--sm-font-heading":e.fontHeading,"--sm-font-body":e.fontBody,"--sm-radius":e.radius,"--sm-shadow":e.shadow,"--sm-space-section":e.spaceSection}}},1506:(e,r,a)=>{"use strict";a.r(r),a.d(r,{default:()=>s,metadata:()=>t});var o=a(9510);a(7272);let t={title:{default:"Vitrina",template:"%s"}};function s({children:e}){return o.jsx("html",{lang:"es",children:o.jsx("body",{children:e})})}},6560:(e,r,a)=>{"use strict";a.r(r),a.d(r,{default:()=>t});var o=a(9510);function t(){return(0,o.jsxs)("main",{className:"flex min-h-screen flex-col items-center justify-center px-6 text-center",children:[o.jsx("h1",{className:"text-2xl font-bold",children:"Sitio no encontrado"}),o.jsx("p",{className:"mt-2 text-gray-600",children:"Este dominio no tiene una vitrina publicada o el sitio est\xe1 en borrador."})]})}},5522:(e,r,a)=>{"use strict";a.d(r,{v:()=>t});var o=a(1615);function t(){let e=(0,o.headers)(),r=(e.get("x-forwarded-host")??e.get("host")??"").split(":")[0].toLowerCase(),a=process.env.NEXT_PUBLIC_DEFAULT_HOST?.trim().toLowerCase();return a&&("localhost"===r||"127.0.0.1"===r||r.endsWith(".vercel.app"))?a:r||a||"localhost"}},263:(e,r,a)=>{"use strict";function o(e){return{id:e.id,make:e.make,model:e.model,year:e.year,price:e.price,mileage:e.mileage,primary_image_url:e.primary_image_url,images:e.images}}a.d(r,{S:()=>o})},1962:(e,r,a)=>{"use strict";function o(){let e=process.env.VITRINA_FUNCTIONS_URL?.replace(/\/$/,"");if(e)return e;let r="https://example.supabase.co".replace(/\/$/,"");if(!r)throw Error("Missing NEXT_PUBLIC_SUPABASE_URL");return`${r}/functions/v1`}async function t(e,r,a){let t=new URL(`${o()}/public-vitrina`);if(t.searchParams.set("host",e),t.searchParams.set("path",r),a)for(let[e,r]of Object.entries(a))t.searchParams.set(e,r);let s=await fetch(t.toString(),{next:{revalidate:60}});if(404===s.status)return null;if(!s.ok){let e=await s.text().catch(()=>"");throw Error(`public-vitrina ${s.status}: ${e.slice(0,200)}`)}return await s.json()}async function s(e){return t(e,"home")}async function i(e){return t(e,"vehicles")}async function n(e,r){return t(e,"vehicle",{id:r})}async function l(e,r){let a=`${o()}/vitrina-lead`,t=await fetch(a,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...r,host:e}),cache:"no-store"}),s=await t.json().catch(()=>({}));return t.ok?{ok:!0}:{error:s.error??"Error al enviar"}}a.d(r,{Ln:()=>n,X4:()=>s,jU:()=>l,o5:()=>i})},5801:(e,r,a)=>{"use strict";a.d(r,{Z:()=>d});var o=a(1159);let t=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),s=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,r,a)=>a?a.toUpperCase():r.toLowerCase()),i=e=>{let r=s(e);return r.charAt(0).toUpperCase()+r.slice(1)},n=(...e)=>e.filter((e,r,a)=>!!e&&""!==e.trim()&&a.indexOf(e)===r).join(" ").trim(),l=e=>{for(let r in e)if(r.startsWith("aria-")||"role"===r||"title"===r)return!0};var m={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let c=(0,o.forwardRef)(({color:e="currentColor",size:r=24,strokeWidth:a=2,absoluteStrokeWidth:t,className:s="",children:i,iconNode:c,...d},f)=>(0,o.createElement)("svg",{ref:f,...m,width:r,height:r,stroke:e,strokeWidth:t?24*Number(a)/Number(r):a,className:n("lucide",s),...!i&&!l(d)&&{"aria-hidden":"true"},...d},[...c.map(([e,r])=>(0,o.createElement)(e,r)),...Array.isArray(i)?i:[i]])),d=(e,r)=>{let a=(0,o.forwardRef)(({className:a,...s},l)=>(0,o.createElement)(c,{ref:l,iconNode:r,className:n(`lucide-${t(i(e))}`,`lucide-${e}`,a),...s}));return a.displayName=i(e),a}},8412:(e,r,a)=>{"use strict";a.d(r,{n:()=>f});var o=a(9510),t=a(5801);let s=(0,t.Z)("gauge",[["path",{d:"m12 14 4-4",key:"9kzdfg"}],["path",{d:"M3.34 19a10 10 0 1 1 17.32 0",key:"19p75a"}]]),i=(0,t.Z)("arrow-right",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]]);var n=a(1857);function l(e){if(e.primary_image_url)return e.primary_image_url;if(Array.isArray(e.images)&&e.images.length>0){let r=e.images[0];if("string"==typeof r)return r;if(r&&"object"==typeof r&&"url"in r)return String(r.url)}return null}function m(e){return null==e?"Consultar":new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(e)}let c={backgroundColor:"var(--sm-surface)",border:"1px solid var(--sm-border)",borderRadius:"var(--sm-radius)",boxShadow:"var(--sm-shadow)"};function d({v:e,linkBasePath:r,index:a=0}){let t=l(e),n=[e.make,e.model].filter(Boolean).join(" ")||"Veh\xedculo",d=["sm-d1","sm-d2","sm-d3","sm-d4","sm-d5"][a%5],f=(0,o.jsxs)("article",{className:`sm-card sm-fade-up ${d} group relative overflow-hidden`,style:c,children:[(0,o.jsxs)("div",{className:"relative aspect-[16/10] overflow-hidden",style:{backgroundColor:"var(--sm-border)"},children:[t?o.jsx("img",{src:t,alt:n,className:"h-full w-full object-cover",loading:"lazy"}):o.jsx("div",{className:"flex h-full items-center justify-center text-sm",style:{color:"var(--sm-muted)"},children:"Sin foto"}),o.jsx("div",{className:"pointer-events-none absolute inset-x-0 bottom-0 h-1/2",style:{background:"linear-gradient(to top, rgba(0,0,0,0.5), transparent)"}}),o.jsx("span",{className:"sm-shine"}),e.year?o.jsx("span",{className:"absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm",style:{backgroundColor:"color-mix(in srgb, var(--sm-bg) 70%, transparent)",color:"var(--sm-fg)"},children:e.year}):null]}),(0,o.jsxs)("div",{className:"p-4",children:[o.jsx("h3",{className:"font-semibold",style:{color:"var(--sm-fg)",fontFamily:"var(--sm-font-heading)"},children:n}),o.jsx("div",{className:"mt-2 flex flex-wrap gap-3 text-xs",style:{color:"var(--sm-muted)"},children:e.mileage?(0,o.jsxs)("span",{className:"inline-flex items-center gap-1",children:[o.jsx(s,{className:"h-3.5 w-3.5"}),new Intl.NumberFormat("es-CL").format(e.mileage)," km"]}):null}),(0,o.jsxs)("div",{className:"mt-3 flex items-center justify-between",children:[o.jsx("p",{className:"text-xl font-bold",style:{color:"var(--sm-primary)"},children:m(e.price)}),(0,o.jsxs)("span",{className:"inline-flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100",style:{color:"var(--sm-fg)"},children:["Ver ",o.jsx(i,{className:"h-3.5 w-3.5"})]})]})]})]});return r?o.jsx("a",{href:`${r}/${e.id}`,className:"block",children:f}):f}function f({props:e,vehicles:r,loading:a,linkBasePath:t,theme:s,anchorId:i="stock"}){let f=(0,n.Uk)(s),p=r.slice(0,e.limit||12),u={paddingTop:"var(--sm-space-section)",paddingBottom:"var(--sm-space-section)"};return f?o.jsx("section",{id:i,className:"px-4 md:px-6",style:u,children:(0,o.jsxs)("div",{className:"mx-auto max-w-7xl",children:[o.jsx("p",{className:"sm-fade-up text-xs font-semibold uppercase tracking-[0.3em]",style:{color:"var(--sm-primary)"},children:"Inventario"}),o.jsx("h2",{className:"sm-fade-up sm-d1 mt-2 text-2xl font-bold uppercase tracking-wide md:text-3xl",style:{color:"var(--sm-fg)",fontFamily:"var(--sm-font-heading)"},children:e.title||"Nuestro stock"}),a?o.jsx("div",{className:"mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4",children:Array.from({length:4}).map((e,r)=>o.jsx("div",{className:"animate-pulse aspect-[4/5] rounded-xl",style:c},r))}):0===p.length?o.jsx("p",{className:"mt-8 text-center text-sm",style:{color:"var(--sm-muted)"},children:"Pr\xf3ximamente publicaremos veh\xedculos. Consultanos por WhatsApp."}):o.jsx("div",{className:"mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4",children:p.map((e,r)=>o.jsx(d,{v:e,linkBasePath:t,index:r},e.id))})]})}):(0,o.jsxs)("section",{id:i,className:"px-6",style:u,children:[o.jsx("h2",{className:"text-center text-2xl font-bold md:text-3xl",style:{color:"var(--sm-fg)",fontFamily:"var(--sm-font-heading)"},children:e.title||"Nuestro stock"}),o.jsx("span",{className:"mx-auto mb-8 mt-3 block h-1 w-12 rounded-full",style:{backgroundColor:"var(--sm-primary)"}}),a?o.jsx("div",{className:"mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",children:Array.from({length:3}).map((e,r)=>(0,o.jsxs)("div",{className:"animate-pulse overflow-hidden",style:c,children:[o.jsx("div",{className:"aspect-[4/3]",style:{backgroundColor:"var(--sm-border)"}}),(0,o.jsxs)("div",{className:"space-y-2 p-4",children:[o.jsx("div",{className:"h-4 w-2/3 rounded",style:{backgroundColor:"var(--sm-border)"}}),o.jsx("div",{className:"h-4 w-1/3 rounded",style:{backgroundColor:"var(--sm-border)"}})]})]},r))}):0===p.length?o.jsx("p",{className:"text-center text-sm",style:{color:"var(--sm-muted)"},children:'A\xfan no hay veh\xedculos publicados. Marc\xe1 autos como "Mostrar en mi web" desde el inventario.'}):o.jsx("div",{className:"mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",children:p.map(e=>{let r=l(e),a=(0,o.jsxs)("div",{className:"overflow-hidden",style:c,children:[o.jsx("div",{className:"aspect-[4/3]",style:{backgroundColor:"var(--sm-border)"},children:r?o.jsx("img",{src:r,alt:`${e.make??""} ${e.model??""}`,className:"h-full w-full object-cover",loading:"lazy"}):o.jsx("div",{className:"flex h-full w-full items-center justify-center text-sm",style:{color:"var(--sm-muted)"},children:"Sin foto"})}),(0,o.jsxs)("div",{className:"p-4",children:[(0,o.jsxs)("p",{className:"font-semibold",style:{color:"var(--sm-fg)"},children:[[e.make,e.model].filter(Boolean).join(" ")||"Veh\xedculo",e.year?(0,o.jsxs)("span",{style:{color:"var(--sm-muted)"},children:[" \xb7 ",e.year]}):null]}),e.mileage?(0,o.jsxs)("p",{className:"text-xs",style:{color:"var(--sm-muted)"},children:[new Intl.NumberFormat("es-CL").format(e.mileage)," km"]}):null,o.jsx("p",{className:"mt-2 text-lg font-bold",style:{color:"var(--sm-primary)"},children:m(e.price)})]})]});return t?o.jsx("a",{href:`${t}/${e.id}`,className:"block transition-opacity hover:opacity-90",children:a},e.id):o.jsx("div",{children:a},e.id)})})]})}},1857:(e,r,a)=>{"use strict";a.d(r,{Uk:()=>i});let o="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",t="Georgia, 'Times New Roman', serif",s={"poppins-inter":{label:"Poppins + Inter",heading:`'Poppins', ${o}`,body:`'Inter', ${o}`,googleFamilies:["Poppins:wght@500;600;700","Inter:wght@400;500;600"]},"playfair-lora":{label:"Playfair + Lora",heading:`'Playfair Display', ${t}`,body:`'Lora', ${t}`,googleFamilies:["Playfair+Display:wght@600;700","Lora:wght@400;500"]},"montserrat-roboto":{label:"Montserrat + Roboto",heading:`'Montserrat', ${o}`,body:`'Roboto', ${o}`,googleFamilies:["Montserrat:wght@600;700","Roboto:wght@400;500"]},"space-inter":{label:"Space Grotesk + Inter",heading:`'Space Grotesk', ${o}`,body:`'Inter', ${o}`,googleFamilies:["Space+Grotesk:wght@500;600;700","Inter:wght@400;500;600"]}};function i(e){return"miami"===e||"premium"===e}s["poppins-inter"].heading,s["poppins-inter"].body,s["playfair-lora"].heading,s["playfair-lora"].body,s["montserrat-roboto"].heading,s["montserrat-roboto"].body,s["montserrat-roboto"].heading,s["montserrat-roboto"].body},7272:()=>{}};