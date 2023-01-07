var v=Object.defineProperty;var E=(d,e,t)=>e in d?v(d,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):d[e]=t;var i=(d,e,t)=>(E(d,typeof e!="symbol"?e+"":e,t),t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const s of r.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function t(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerpolicy&&(r.referrerPolicy=n.referrerpolicy),n.crossorigin==="use-credentials"?r.credentials="include":n.crossorigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function o(n){if(n.ep)return;n.ep=!0;const r=t(n);fetch(n.href,r)}})();const T=window.Plotly;class M{constructor(){i(this,"chartDiv");i(this,"debugCont");i(this,"sensorsCont");i(this,"sensorsTemplate");i(this,"brokerTemplate");i(this,"calibrationTemplate");i(this,"brokerCont");i(this,"viewSwitchButton");i(this,"calibrationDialog");i(this,"currentConfig",null);i(this,"currentTask",Promise.resolve());i(this,"viewState","EMA");this.chartDiv="chart",this.debugCont=document.getElementById("debug-cont"),this.debugCont.innerHTML="",this.viewSwitchButton=document.getElementById("view-switch-btn"),this.sensorsCont=document.getElementById("sensors-form"),this.brokerCont=document.getElementById("broker-container"),this.calibrationDialog=document.getElementById("calibration-dialog");const e=document.getElementById("sensors-template").innerHTML;this.sensorsTemplate=Handlebars.compile(e);const t=document.getElementById("broker-template").innerHTML;this.brokerTemplate=Handlebars.compile(t),this.calibrationTemplate=Handlebars.compile(document.getElementById("calibration-template").innerHTML),this.viewSwitchButton.onclick=()=>this.switchView()}start(){this.readMqttConfig().then(()=>this.readConfig()).then(()=>{if(!this.currentConfig)throw new Error("Config required!");return this.renderSensorsConfigForm(this.currentConfig["sensors-config"]),this.createGraph(this.currentConfig["sensors-config"])}).then(()=>this.startTemperatureRead())}updateBrokerConfig(){const e=document.getElementById("broker-config-form"),t=new FormData(e),o={broker_host:t.get("broker_host"),broker_port:parseInt(t.get("broker_port")),keepalive:parseInt(t.get("keepalive")),topic:t.get("topic"),client_name:t.get("client_name"),user:t.get("user"),password:t.get("password")};return this.runTask(()=>fetch("/api/mqtt_config",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(o)}).then(n=>n.json()).then(n=>(this.renderBrokerConfigForm(n),n)))}updateConfigUI(){if(!this.currentConfig)throw new Error("Config required!");const e=document.getElementById("update-config-form"),t=new FormData(e),o=t.getAll("sid"),n=t.getAll("name"),r=t.getAll("field"),s=t.getAll("color"),c=t.getAll("cal"),l=JSON.parse(JSON.stringify(this.currentConfig["sensors-config"]));return o.forEach((h,a)=>{l[h].name=n[a],l[h].field=r[a],l[h].color=s[a],l[h].cal=parseFloat(c[a])}),this.updateConfigInternal(l)}startTemperatureRead(){return this.runTask(()=>{const e=new URLSearchParams;return e.set("type",this.viewState==="EMA"?"ema":"raw"),fetch(`/api/temperature?${e.toString()}`).then(t=>t.json()).then(t=>{if(!this.currentConfig)throw new Error("Config required!");const o=new Date((t[0]+this.currentConfig["time-correction"])*1e3),n=[],r=[],s=[];for(let c=1;c<t.length;c++){const l=t[c][0],h=this.currentConfig["sensors-config"][l].chartInd;h!=null&&(s.push(h),n.push([t[c][1]]),r.push([o]))}T.extendTraces(this.chartDiv,{y:n,x:r},s)}).catch(t=>{console.error("readTemperature",t)})}).then(()=>setTimeout(()=>this.startTemperatureRead(),1e3))}readConfig(){return this.runTask(()=>fetch("/api/config").then(e=>e.json()).then(e=>(this.currentConfig=e,e)).catch(e=>{console.error("Can not read config",e)}))}readMqttConfig(){return this.runTask(()=>fetch("/api/mqtt_config").then(e=>e.json()).then(e=>(this.renderBrokerConfigForm(e),e)).catch(e=>{console.error("Can not Mqtt read config",e)}))}randomColor(e){e=e%3;const o=e*(16777215/3);let n=Math.floor(o+Math.random()*16777215/3).toString(16);for(;n.length<6;)n="0"+n;return"#"+n}runTask(e){return this.currentTask=this.currentTask.then(()=>e(),()=>e()),this.currentTask}renderSensorsConfigForm(e){const t=Object.entries(e).map(([o,n])=>({sid:o,add:n.add_str,name:n.name,field:n.field,color:n.color,cal:n.cal}));this.sensorsCont.innerHTML=this.sensorsTemplate({sensors:t})}renderBrokerConfigForm(e){this.brokerCont.innerHTML=this.brokerTemplate(e)}switchView(){return this.runTask(()=>{if(!this.currentConfig)return Promise.resolve();switch(this.viewState=this.viewState==="EMA"?"CALIBRATION":"EMA",this.viewState){case"EMA":this.viewSwitchButton.innerHTML="Show Calibration Data",this.viewSwitchButton.classList.remove("secondary");break;case"CALIBRATION":this.viewSwitchButton.innerHTML="Show EMA Data",this.viewSwitchButton.classList.add("secondary");break}return T.purge(this.chartDiv),this.createGraph(this.currentConfig["sensors-config"])})}updateConfigInternal(e){return Object.values(e).forEach(t=>{t.addr="",t.add_str=""}),this.runTask(()=>fetch("/api/config",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(e)}).then(t=>t.json()).then(t=>{var n;const o=((n=this.currentConfig)==null?void 0:n["sensors-config"])??{};return Object.entries(t["sensors-config"]).forEach(([r,s])=>{var c;s.chartInd=(c=o[r])==null?void 0:c.chartInd}),this.currentConfig=t,this.currentConfig&&Object.entries(this.currentConfig["sensors-config"]),this.renderSensorsConfigForm(t["sensors-config"]),t}).catch(t=>{console.error("Can not read config",t)}))}createGraph(e){const t=Object.entries(e),o=[];for(let n=0;n<t.length;n++){const[,r]=t[n],s=r.color??this.randomColor(n);r.color=s,r.chartInd=n,o.push({x:[],y:[],mode:"lines",line:{color:s}})}return T.newPlot(this.chartDiv,o,{dragmode:"select"}).then(n=>{n.on("plotly_selected",r=>{if(!(r!=null&&r.range)||!this.currentConfig)return;const s=this.currentConfig["sensors-config"],[c,l]=r.range.x.map(u=>new Date(u)),h=n.data;let a=[];const k=new Map;h.forEach((u,C)=>{const g=u.x,f=u.y,m=g.map((p,S)=>({date:p,val:f[S]})).filter(({date:p})=>p>=c&&p<=l).map(({val:p})=>p).sort();a.push(...m);const w=m[Math.trunc(m.length/2)];k.set(C,w)}),a=a.sort();const I=a[Math.trunc(a.length/2)],b=[];k.forEach((u,C)=>{const g=Object.entries(s).find(([,f])=>f.chartInd==C);if(g){const f=parseFloat((I-u).toFixed(2));b.push({value:f,color:g[1].color,sid:g[0]})}}),this.calibrationDialog.innerHTML=this.calibrationTemplate({sensors:b}),this.calibrationDialog.showModal(),this.calibrationDialog.onclose=()=>{if(this.calibrationDialog.returnValue==="ok"){const u=JSON.parse(JSON.stringify(s));Object.entries(u).forEach(([C,g])=>{var m;const f=(m=b.find(w=>w.sid==C))==null?void 0:m.value;f!=null&&(g.cal=f)}),this.updateConfigInternal(u).then(()=>this.switchView())}}})})}}const y=new M;document.getElementById("update-config-btn").onclick=()=>y.updateConfigUI();document.getElementById("update-broker-btn").onclick=()=>y.updateBrokerConfig();y.start();