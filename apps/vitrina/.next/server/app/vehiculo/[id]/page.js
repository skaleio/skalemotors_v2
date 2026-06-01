(()=>{var e={};e.id=130,e.ids=[130],e.modules={2934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},171:(e,r,o)=>{"use strict";o.r(r),o.d(r,{GlobalError:()=>n.a,__next_app__:()=>f,originalPathname:()=>d,pages:()=>c,routeModule:()=>p,tree:()=>m}),o(8505),o(1506),o(6560);var a=o(3191),t=o(8716),s=o(7922),n=o.n(s),i=o(5231),l={};for(let e in i)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>i[e]);o.d(r,l);let m=["",{children:["vehiculo",{children:["[id]",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(o.bind(o,8505)),"C:\\Users\\SERGI\\Documents\\skalemotors\\skalemotors_v2\\apps\\vitrina\\app\\vehiculo\\[id]\\page.tsx"]}]},{}]},{}]},{layout:[()=>Promise.resolve().then(o.bind(o,1506)),"C:\\Users\\SERGI\\Documents\\skalemotors\\skalemotors_v2\\apps\\vitrina\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(o.bind(o,6560)),"C:\\Users\\SERGI\\Documents\\skalemotors\\skalemotors_v2\\apps\\vitrina\\app\\not-found.tsx"]}],c=["C:\\Users\\SERGI\\Documents\\skalemotors\\skalemotors_v2\\apps\\vitrina\\app\\vehiculo\\[id]\\page.tsx"],d="/vehiculo/[id]/page",f={require:o,loadChunk:()=>Promise.resolve()},p=new a.AppPageRouteModule({definition:{kind:t.x.APP_PAGE,page:"/vehiculo/[id]/page",pathname:"/vehiculo/[id]",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:m}})},6361:()=>{},6475:(e,r,o)=>{Promise.resolve().then(o.bind(o,1558)),Promise.resolve().then(o.bind(o,358)),Promise.resolve().then(o.t.bind(o,9404,23))},7941:(e,r,o)=>{Promise.resolve().then(o.t.bind(o,2994,23)),Promise.resolve().then(o.t.bind(o,6114,23)),Promise.resolve().then(o.t.bind(o,9727,23)),Promise.resolve().then(o.t.bind(o,9671,23)),Promise.resolve().then(o.t.bind(o,1868,23)),Promise.resolve().then(o.t.bind(o,4759,23))},5303:()=>{},1558:(e,r,o)=>{"use strict";o.d(r,{LeadForm:()=>s});var a=o(326),t=o(7577);function s({host:e,vehicleId:r,vehicleLabel:o}){let[s,n]=(0,t.useState)("idle"),[i,l]=(0,t.useState)("");async function m(o){o.preventDefault(),n("loading"),l("");let a=new FormData(o.currentTarget),t={full_name:a.get("full_name"),phone:a.get("phone"),email:a.get("email"),message:a.get("message"),vehicle_id:r??null,company:a.get("company"),host:e};try{let e=await fetch("/api/lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}),r=await e.json();if(!e.ok)throw Error(r.error??"Error al enviar");n("ok"),o.currentTarget.reset()}catch(e){n("error"),l(e instanceof Error?e.message:"Error al enviar")}}return"ok"===s?a.jsx("p",{className:"rounded-md border p-4 text-sm",style:{borderColor:"var(--sm-border)",color:"var(--sm-fg)"},children:"\xa1Gracias! Te contactaremos pronto."}):(0,a.jsxs)("form",{onSubmit:m,className:"mx-auto max-w-md space-y-3",children:[o?(0,a.jsxs)("p",{className:"text-sm",style:{color:"var(--sm-muted)"},children:["Consulta por: ",a.jsx("strong",{children:o})]}):null,a.jsx("input",{type:"text",name:"company",className:"hidden",tabIndex:-1,autoComplete:"off"}),a.jsx("input",{name:"full_name",required:!0,placeholder:"Nombre",className:"w-full rounded-md border px-3 py-2 text-sm",style:{borderColor:"var(--sm-border)",background:"var(--sm-surface)",color:"var(--sm-fg)"}}),a.jsx("input",{name:"phone",required:!0,placeholder:"Tel\xe9fono / WhatsApp",className:"w-full rounded-md border px-3 py-2 text-sm",style:{borderColor:"var(--sm-border)",background:"var(--sm-surface)",color:"var(--sm-fg)"}}),a.jsx("input",{name:"email",type:"email",placeholder:"Email (opcional)",className:"w-full rounded-md border px-3 py-2 text-sm",style:{borderColor:"var(--sm-border)",background:"var(--sm-surface)",color:"var(--sm-fg)"}}),a.jsx("textarea",{name:"message",rows:3,placeholder:"Mensaje",className:"w-full rounded-md border px-3 py-2 text-sm",style:{borderColor:"var(--sm-border)",background:"var(--sm-surface)",color:"var(--sm-fg)"}}),"error"===s?a.jsx("p",{className:"text-sm text-red-600",children:i}):null,a.jsx("button",{type:"submit",disabled:"loading"===s,className:"w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60",style:{backgroundColor:"var(--sm-primary)",color:"var(--sm-primary-fg)"},children:"loading"===s?"Enviando…":"Enviar consulta"})]})}},5283:(e,r,o)=>{"use strict";o.d(r,{SiteThemeProvider:()=>n});var a=o(326);o(7577);var t=o(6351);let s=`
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
`;function n({site:e,children:r,className:o}){let n=(0,t.$E)(e),i=(0,t.Zo)(n);return(0,t.NW)(e),(0,a.jsxs)("div",{className:o,style:{...i,background:"var(--sm-bg)",color:"var(--sm-fg)",fontFamily:"var(--sm-font-body)"},children:[a.jsx("style",{dangerouslySetInnerHTML:{__html:s}}),r]})}},358:(e,r,o)=>{"use strict";o.d(r,{VitrinaShell:()=>n});var a=o(326);o(7577);var t=o(5283),s=o(6351);function n({site:e,children:r}){let o=(0,s.NW)(e);return(0,a.jsxs)(a.Fragment,{children:[a.jsx("link",{rel:"stylesheet",href:o}),a.jsx(t.SiteThemeProvider,{site:e,children:r})]})}},6351:(e,r,o)=>{"use strict";o.d(r,{$E:()=>f,NW:()=>p,Zo:()=>u});let a="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",t="Georgia, 'Times New Roman', serif",s={"poppins-inter":{label:"Poppins + Inter",heading:`'Poppins', ${a}`,body:`'Inter', ${a}`,googleFamilies:["Poppins:wght@500;600;700","Inter:wght@400;500;600"]},"playfair-lora":{label:"Playfair + Lora",heading:`'Playfair Display', ${t}`,body:`'Lora', ${t}`,googleFamilies:["Playfair+Display:wght@600;700","Lora:wght@400;500"]},"montserrat-roboto":{label:"Montserrat + Roboto",heading:`'Montserrat', ${a}`,body:`'Roboto', ${a}`,googleFamilies:["Montserrat:wght@600;700","Roboto:wght@400;500"]},"space-inter":{label:"Space Grotesk + Inter",heading:`'Space Grotesk', ${a}`,body:`'Inter', ${a}`,googleFamilies:["Space+Grotesk:wght@500;600;700","Inter:wght@400;500;600"]}},n={moderna:"poppins-inter",tradicional:"playfair-lora",premium:"montserrat-roboto",miami:"montserrat-roboto"},i={moderna:{colorBg:"#ffffff",colorSurface:"#f8fafc",colorFg:"#0f172a",colorMuted:"#64748b",colorPrimary:"#7c3aed",colorPrimaryFg:"#ffffff",colorSecondary:"#0ea5e9",colorBorder:"#e2e8f0",fontHeading:s["poppins-inter"].heading,fontBody:s["poppins-inter"].body,radius:"0.75rem",shadow:"0 1px 3px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.06)",spaceSection:"4rem"},tradicional:{colorBg:"#ffffff",colorSurface:"#faf7f2",colorFg:"#1c1917",colorMuted:"#78716c",colorPrimary:"#b45309",colorPrimaryFg:"#ffffff",colorSecondary:"#d9b382",colorBorder:"#e7e5e4",fontHeading:s["playfair-lora"].heading,fontBody:s["playfair-lora"].body,radius:"0.25rem",shadow:"0 1px 2px rgba(28,25,23,0.10)",spaceSection:"3.5rem"},premium:{colorBg:"#0b0b0f",colorSurface:"#15151c",colorFg:"#f5f5f7",colorMuted:"#a1a1aa",colorPrimary:"#c8a24a",colorPrimaryFg:"#0b0b0f",colorSecondary:"#f5f5f7",colorBorder:"#26262e",fontHeading:s["montserrat-roboto"].heading,fontBody:s["montserrat-roboto"].body,radius:"0.5rem",shadow:"0 10px 30px rgba(0,0,0,0.45)",spaceSection:"5rem"},miami:{colorBg:"#0a0a0a",colorSurface:"#141418",colorFg:"#ffffff",colorMuted:"#a1a1aa",colorPrimary:"#ec4899",colorPrimaryFg:"#ffffff",colorSecondary:"#f9a8d4",colorBorder:"#2a2a30",fontHeading:s["montserrat-roboto"].heading,fontBody:s["montserrat-roboto"].body,radius:"0.75rem",shadow:"0 16px 48px rgba(0,0,0,0.55)",spaceSection:"5rem"}};function l(e){return"moderna"===e||"tradicional"===e||"premium"===e||"miami"===e}function m(e){return"string"==typeof e&&e in s}function c(e){let r=/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(e.trim());if(!r)return null;let o=r[1];3===o.length&&(o=o.split("").map(e=>e+e).join(""));let a=parseInt(o,16);return{r:a>>16&255,g:a>>8&255,b:255&a}}function d(e){return"string"==typeof e&&e.trim().length>0}function f(e){let r=l(e?.theme)?e.theme:"moderna",o={...i[r]};d(e?.primary_color)&&c(e.primary_color)&&(o.colorPrimary=e.primary_color,o.colorPrimaryFg=function(e){let r=c(e);if(!r)return"#ffffff";let o=e=>{let r=e/255;return r<=.03928?r/12.92:Math.pow((r+.055)/1.055,2.4)};return .2126*o(r.r)+.7152*o(r.g)+.0722*o(r.b)>.179?"#000000":"#ffffff"}(e.primary_color)),d(e?.secondary_color)&&c(e.secondary_color)&&(o.colorSecondary=e.secondary_color);let a=m(e?.font)?e.font:n[r];return o.fontHeading=s[a].heading,o.fontBody=s[a].body,o}function p(e){let r=l(e?.theme)?e.theme:"moderna",o=s[m(e?.font)?e.font:n[r]].googleFamilies.map(e=>`family=${e}`).join("&");return`https://fonts.googleapis.com/css2?${o}&display=swap`}function u(e){return{"--sm-bg":e.colorBg,"--sm-surface":e.colorSurface,"--sm-fg":e.colorFg,"--sm-muted":e.colorMuted,"--sm-primary":e.colorPrimary,"--sm-primary-fg":e.colorPrimaryFg,"--sm-secondary":e.colorSecondary,"--sm-border":e.colorBorder,"--sm-font-heading":e.fontHeading,"--sm-font-body":e.fontBody,"--sm-radius":e.radius,"--sm-shadow":e.shadow,"--sm-space-section":e.spaceSection}}},1506:(e,r,o)=>{"use strict";o.r(r),o.d(r,{default:()=>s,metadata:()=>t});var a=o(9510);o(7272);let t={title:{default:"Vitrina",template:"%s"}};function s({children:e}){return a.jsx("html",{lang:"es",children:a.jsx("body",{children:e})})}},6560:(e,r,o)=>{"use strict";o.r(r),o.d(r,{default:()=>t});var a=o(9510);function t(){return(0,a.jsxs)("main",{className:"flex min-h-screen flex-col items-center justify-center px-6 text-center",children:[a.jsx("h1",{className:"text-2xl font-bold",children:"Sitio no encontrado"}),a.jsx("p",{className:"mt-2 text-gray-600",children:"Este dominio no tiene una vitrina publicada o el sitio est\xe1 en borrador."})]})}},8505:(e,r,o)=>{"use strict";o.r(r),o.d(r,{default:()=>p,dynamic:()=>c,generateMetadata:()=>f,revalidate:()=>d});var a=o(9510),t=o(7371),s=o(8585),n=o(1084),i=o(4891),l=o(5522),m=o(1962);let c="force-dynamic",d=60;async function f({params:e}){let r=(0,l.v)(),o=await (0,m.Ln)(r,e.id);if(!o?.vehicle)return{title:"Veh\xedculo"};let a=o.vehicle,t=[a.make,a.model,a.year].filter(Boolean).join(" "),s=await (0,m.X4)(r);return{title:`${t} | ${s?.site?.site_name??"Vitrina"}`,description:a.description?.slice(0,160)??void 0,openGraph:{title:t,images:a.primary_image_url?[{url:a.primary_image_url}]:void 0},icons:s?.site?.favicon_url?{icon:s.site.favicon_url}:void 0}}async function p({params:e}){var r;let o=(0,l.v)(),c=await (0,m.X4)(o);c?.site||(0,s.notFound)();let d=await (0,m.Ln)(o,e.id);d?.vehicle||(0,s.notFound)();let f=d.vehicle,p=c.site,u=function(e){let r=[];if(e.primary_image_url&&r.push(e.primary_image_url),Array.isArray(e.images))for(let o of e.images)if("string"!=typeof o||r.includes(o)){if(o&&"object"==typeof o&&"url"in o){let e=String(o.url);r.includes(e)||r.push(e)}}else r.push(o);return r}(f),h=[f.make,f.model,f.year].filter(Boolean).join(" ");return a.jsx(i.t,{site:{theme:p.theme,primary_color:p.primary_color,secondary_color:p.secondary_color,font:p.font},children:(0,a.jsxs)("main",{children:[a.jsx("div",{className:"border-b px-4 py-3",style:{borderColor:"var(--sm-border)"},children:a.jsx(t.default,{href:"/vehiculos",className:"text-sm",style:{color:"var(--sm-primary)"},children:"← Volver al stock"})}),a.jsx("article",{className:"mx-auto max-w-5xl px-6 py-10",style:{paddingBottom:"var(--sm-space-section)"},children:(0,a.jsxs)("div",{className:"grid gap-8 md:grid-cols-2",children:[a.jsx("div",{className:"space-y-3",children:u.length?u.map(e=>a.jsx("img",{src:e,alt:h,className:"w-full rounded-lg object-cover",style:{borderRadius:"var(--sm-radius)"}},e)):a.jsx("div",{className:"flex aspect-[4/3] items-center justify-center rounded-lg",style:{backgroundColor:"var(--sm-border)",color:"var(--sm-muted)"},children:"Sin fotos"})}),(0,a.jsxs)("div",{children:[a.jsx("h1",{className:"text-2xl font-bold md:text-3xl",style:{fontFamily:"var(--sm-font-heading)",color:"var(--sm-fg)"},children:h||"Veh\xedculo"}),a.jsx("p",{className:"mt-3 text-2xl font-bold",style:{color:"var(--sm-primary)"},children:null==(r=f.price)?"Consultar":new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(r)}),(0,a.jsxs)("ul",{className:"mt-6 space-y-1 text-sm",style:{color:"var(--sm-muted)"},children:[f.mileage?(0,a.jsxs)("li",{children:["Kilometraje: ",new Intl.NumberFormat("es-CL").format(f.mileage)," km"]}):null,f.fuel_type?(0,a.jsxs)("li",{children:["Combustible: ",f.fuel_type]}):null,f.transmission?(0,a.jsxs)("li",{children:["Transmisi\xf3n: ",f.transmission]}):null,f.color?(0,a.jsxs)("li",{children:["Color: ",f.color]}):null]}),f.description?a.jsx("p",{className:"mt-6 text-sm leading-relaxed",style:{color:"var(--sm-fg)"},children:f.description}):null]})]})}),(0,a.jsxs)("section",{className:"px-6 pb-12",style:{backgroundColor:"var(--sm-surface)"},children:[a.jsx("h2",{className:"mb-4 text-center text-lg font-semibold",style:{fontFamily:"var(--sm-font-heading)",color:"var(--sm-fg)"},children:"Consultar por este auto"}),a.jsx(n.p,{host:o,vehicleId:f.id,vehicleLabel:h})]})]})})}},1084:(e,r,o)=>{"use strict";o.d(r,{p:()=>a});let a=(0,o(8570).createProxy)(String.raw`C:\Users\SERGI\Documents\skalemotors\skalemotors_v2\apps\vitrina\components\LeadForm.tsx#LeadForm`)},4891:(e,r,o)=>{"use strict";o.d(r,{t:()=>a});let a=(0,o(8570).createProxy)(String.raw`C:\Users\SERGI\Documents\skalemotors\skalemotors_v2\apps\vitrina\components\VitrinaShell.tsx#VitrinaShell`)},5522:(e,r,o)=>{"use strict";o.d(r,{v:()=>t});var a=o(1615);function t(){let e=(0,a.headers)(),r=(e.get("x-forwarded-host")??e.get("host")??"").split(":")[0].toLowerCase(),o=process.env.NEXT_PUBLIC_DEFAULT_HOST?.trim().toLowerCase();return o&&("localhost"===r||"127.0.0.1"===r||r.endsWith(".vercel.app"))?o:r||o||"localhost"}},1962:(e,r,o)=>{"use strict";function a(){let e=process.env.VITRINA_FUNCTIONS_URL?.replace(/\/$/,"");if(e)return e;let r="https://example.supabase.co".replace(/\/$/,"");if(!r)throw Error("Missing NEXT_PUBLIC_SUPABASE_URL");return`${r}/functions/v1`}async function t(e,r,o){let t=new URL(`${a()}/public-vitrina`);if(t.searchParams.set("host",e),t.searchParams.set("path",r),o)for(let[e,r]of Object.entries(o))t.searchParams.set(e,r);let s=await fetch(t.toString(),{next:{revalidate:60}});if(404===s.status)return null;if(!s.ok){let e=await s.text().catch(()=>"");throw Error(`public-vitrina ${s.status}: ${e.slice(0,200)}`)}return await s.json()}async function s(e){return t(e,"home")}async function n(e){return t(e,"vehicles")}async function i(e,r){return t(e,"vehicle",{id:r})}async function l(e,r){let o=`${a()}/vitrina-lead`,t=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...r,host:e}),cache:"no-store"}),s=await t.json().catch(()=>({}));return t.ok?{ok:!0}:{error:s.error??"Error al enviar"}}o.d(r,{Ln:()=>i,X4:()=>s,jU:()=>l,o5:()=>n})},7272:()=>{}};var r=require("../../../webpack-runtime.js");r.C(e);var o=e=>r(r.s=e),a=r.X(0,[948,669,615,15],()=>o(171));module.exports=a})();