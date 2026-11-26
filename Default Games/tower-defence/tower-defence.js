(() => {
  "use strict";

  const canvas = document.getElementById("battlefield");
  const W = 960, H = 600;
  const WORLD_W = 16, WORLD_D = 10;
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:"high-performance"});
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12231c);
  const camera = new THREE.OrthographicCamera(-10,10,6.25,-6.25,.1,100);
  let cameraAngle=Math.PI/4;camera.position.set(13,11,13);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xe5f4df,0x263c30,1.35));
  scene.add(new THREE.AmbientLight(0xffffff,.38));
  const sun = new THREE.DirectionalLight(0xffedcf,2.1);sun.position.set(-7,15,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.bias=-.0004;scene.add(sun);
  const worldGroup=new THREE.Group(),entityGroup=new THREE.Group(),effectGroup=new THREE.Group();scene.add(worldGroup,entityGroup,effectGroup);
  const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();
  const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const worldPoint=new THREE.Vector3();
  const materials={
    roadEdge:new THREE.MeshStandardMaterial({color:0x514b39,roughness:1}),
    road:new THREE.MeshStandardMaterial({color:0xb9a778,roughness:.98}),
    roadMark:new THREE.MeshStandardMaterial({color:0xe5d2a0,roughness:.9}),
    wood:new THREE.MeshStandardMaterial({color:0x644930,roughness:.55}),
    leaves:new THREE.MeshStandardMaterial({color:0x3d784c,roughness:.92}),
    pine:new THREE.MeshStandardMaterial({color:0x326448,roughness:.9}),
    gold:new THREE.MeshStandardMaterial({color:0xe6c778,metalness:.35,roughness:.33}),
    core:new THREE.MeshStandardMaterial({color:0xffdf89,emissive:0xd89736,emissiveIntensity:1.15,metalness:.2,roughness:.25})
  };
  const unitCylinder=new THREE.CylinderGeometry(1,1,1,16);
  const maps = {
    harbour: {
      name:"Harbour Hold", tag:"HARBOUR HOLD", subtitle:"Protect the harbour road. Each enemy that gets through damages your core.",
      colors:["#32614a","#28553f","#396c50"], path:[[ -20,170],[190,170],[190,420],[430,420],[430,240],[670,240],[670,440],[925,440]],
      props:[[45,85,31],[105,510,45],[315,88,24],[330,510,31],[540,85,38],[805,105,27],[830,535,39],[70,300,13]]
    },
    pinewood: {
      name:"Pinewood Pass", tag:"PINEWOOD PASS", subtitle:"A longer trail through the trees. Watch the bends and cover the open stretches.",
      colors:["#345d42","#2d533a","#3b6845"], path:[[-20,490],[190,490],[190,130],[410,130],[410,460],[680,460],[680,190],[925,190]],
      props:[[68,130,36],[95,330,26],[300,280,34],[320,540,25],[530,80,32],[535,315,25],[800,350,37],[830,530,30],[88,550,18]]
    },
    clifftop: {
      name:"Clifftop Run", tag:"CLIFFTOP RUN", subtitle:"Tight turns along the headland leave less room for error. Set your towers carefully.",
      colors:["#49624c","#3d5948","#536c50"], path:[[-20,320],[145,320],[145,120],[340,120],[340,455],[530,455],[530,255],[740,255],[740,485],[925,485]],
      props:[[54,90,34],[70,510,28],[250,255,39],[252,535,20],[440,75,30],[640,110,36],[622,370,24],[850,90,34],[870,385,20]]
    }
  };
  const towerTypes = {
    archer:{name:"Archer",cost:100,damage:12,range:155,rate:.54,projectile:430,color:"#a9e8a6",kind:"arrow",desc:"Quick shots with reliable range."},
    cannon:{name:"Cannon",cost:165,damage:35,range:132,rate:1.42,projectile:300,color:"#ffb36f",kind:"blast",splash:55,desc:"Heavy shells deal splash damage."},
    frost:{name:"Frost",cost:145,damage:5,range:142,rate:.78,projectile:370,color:"#9ce7ff",kind:"frost",slow:.48,desc:"Chills enemies to slow their march."},
    sniper:{name:"Sniper",cost:210,damage:72,range:255,rate:2.05,projectile:680,color:"#f3db9a",kind:"sniper",desc:"Long range shots hit very hard."}
  };
  const enemyTypes = {
    scout:{name:"Scout",health:40,speed:52,reward:18,damage:1,color:"#ed7865",radius:12},
    runner:{name:"Runner",health:29,speed:87,reward:20,damage:1,color:"#ffc366",radius:10},
    brute:{name:"Brute",health:155,speed:28,reward:42,damage:3,color:"#bb85df",radius:16},
    shield:{name:"Guard",health:90,speed:39,reward:33,damage:2,color:"#71b6e9",radius:14,armor:.18},
    boss:{name:"Siege Leader",health:520,speed:23,reward:150,damage:7,color:"#e56888",radius:23}
  };

  const ui = {
    mapTitle:document.getElementById("map-title"), mapSubtitle:document.getElementById("map-subtitle"), mapTag:document.getElementById("map-tag-name"),
    health:document.getElementById("health-value"), healthFill:document.getElementById("health-fill"), cash:document.getElementById("cash-value"), wave:document.getElementById("wave-value"),
    waveBtn:document.getElementById("wave-btn"), speedBtn:document.getElementById("speed-btn"), pauseBtn:document.getElementById("pause-btn"), battleState:document.getElementById("battle-state"),
    buildHint:document.getElementById("build-hint"), canvasHint:document.getElementById("canvas-hint"), event:document.getElementById("event-message"), kills:document.getElementById("kill-count"),
    toast:document.getElementById("toast"), banner:document.getElementById("wave-banner"), setup:document.getElementById("setup-screen"), gameover:document.getElementById("gameover-screen"),
    inspectorTitle:document.getElementById("inspector-title"), inspectorDesc:document.getElementById("inspector-description"), inspectorStats:document.getElementById("inspector-stats"),
    inspectorLevel:document.getElementById("inspector-level"), inspectorDamage:document.getElementById("inspector-damage"), upgrade:document.getElementById("upgrade-btn"), upgradeCost:document.getElementById("upgrade-cost")
  };
  const state = {
    mapId:"harbour", started:false, over:false, paused:false, speed:1, cash:420, health:25, maxHealth:25,
    wave:0, kills:0, waveActive:false, queue:[], spawnTimer:0, enemies:[], towers:[], bullets:[], particles:[], floaters:[],
    selectedBuild:null, selectedTower:null, pointer:{x:-100,y:-100}, lastTime:0, toastTimer:0, coreFlash:0
  };

  function currentMap(){ return maps[state.mapId]; }
  function toWorld(x,y,height=0){return new THREE.Vector3((x/W-.5)*WORLD_W,height,(y/H-.5)*WORLD_D);}
  function toLogical(point){return{x:(point.x/WORLD_W+.5)*W,y:(point.z/WORLD_D+.5)*H};}
  function pathLength(){ const p=currentMap().path; let n=0; for(let i=1;i<p.length;i++) n+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]); return n; }
  function pointOnPath(distance){
    const map=currentMap();
    if(map.curve){const t=THREE.MathUtils.clamp(distance/pathLength(),0,1),v=toLogical(map.curve.getPointAt(t)),tan=map.curve.getTangentAt(t);return{x:v.x,y:v.y,angle:Math.atan2(tan.z,tan.x)};}
    const p=currentMap().path; let remaining=distance;
    for(let i=1;i<p.length;i++){
      const a=p[i-1],b=p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(remaining<=len){const t=len?remaining/len:0;return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};}
      remaining-=len;
    }
    const last=p[p.length-1],prev=p[p.length-2]; return{x:last[0],y:last[1],angle:Math.atan2(last[1]-prev[1],last[0]-prev[0])};
  }
  function distanceToPath(x,y){
    const curve=currentMap().curve;
    if(curve){let best=Infinity;for(let i=0;i<=120;i++){const p=toLogical(curve.getPointAt(i/120));best=Math.min(best,Math.hypot(x-p.x,y-p.y));}return best;}
    const p=currentMap().path; let best=Infinity;
    for(let i=1;i<p.length;i++){
      const a=p[i-1],b=p[i],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den));
      best=Math.min(best,Math.hypot(x-(a[0]+t*dx),y-(a[1]+t*dy)));
    }
    return best;
  }
  function toast(message){
    ui.toast.textContent=message; ui.toast.classList.add("show"); state.toastTimer=2.5;
  }
  function report(message){ ui.event.textContent=message; }
  function floatText(x,y,text,color="#f5e8b3"){
    const textCanvas=document.createElement("canvas");textCanvas.width=256;textCanvas.height=64;const textCtx=textCanvas.getContext("2d");
    textCtx.font="700 28px DM Sans, sans-serif";textCtx.textAlign="center";textCtx.textBaseline="middle";textCtx.lineWidth=7;textCtx.strokeStyle="rgba(13,25,18,.8)";textCtx.strokeText(text,128,32);textCtx.fillStyle=color;textCtx.fillText(text,128,32);
    const texture=new THREE.CanvasTexture(textCanvas);texture.encoding=THREE.sRGBEncoding;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.scale.set(1.45,.37,1);sprite.position.copy(toWorld(x,y,.65));effectGroup.add(sprite);
    state.floaters.push({x,y,text,color,life:1.15,max:1.15,mesh:sprite,texture});
  }
  function updateHud(){
    ui.health.textContent=`${state.health} / ${state.maxHealth}`;
    const pct=Math.max(0,state.health/state.maxHealth*100); ui.healthFill.style.width=`${pct}%`;
    ui.healthFill.style.background=pct<35?"linear-gradient(90deg,#ed6158,#f5a36c)":"linear-gradient(90deg,#59c68c,#b5e47d)";
    ui.cash.textContent=state.cash.toLocaleString(); ui.wave.textContent=state.waveActive?`${state.wave} · Live`:state.wave?`${state.wave} · Clear`:"Ready";
    ui.waveBtn.textContent=state.waveActive?"Wave in progress…":`Start Wave ${state.wave+1}`;
    const arrow=document.createElement("span"); arrow.textContent="→"; ui.waveBtn.appendChild(arrow);
    ui.waveBtn.disabled=state.waveActive||state.over;
    ui.speedBtn.disabled=!state.waveActive||state.over; ui.speedBtn.textContent=`${state.speed}× Speed`;
    ui.pauseBtn.disabled=!state.waveActive||state.over;ui.pauseBtn.textContent=state.paused?"▶ Resume":"Pause";
    ui.battleState.classList.toggle("is-wave",state.waveActive);
    ui.battleState.innerHTML=state.over?"<i></i> Core offline":state.paused?"<i></i> Paused":state.waveActive?"<i></i> Enemies approaching":"<i></i> Build your defence";
    ui.kills.textContent=`${state.kills} defeated`;
    document.querySelectorAll(".tower-option").forEach(btn=>{
      const type=towerTypes[btn.dataset.tower]; btn.disabled=state.cash<type.cost||state.over;
      btn.classList.toggle("selected",state.selectedBuild===btn.dataset.tower);
    });
    ui.buildHint.textContent=state.selectedBuild?`${towerTypes[state.selectedBuild].name} selected · click an open tile`:"Select a tower to place";
    ui.canvasHint.textContent=state.selectedBuild?`Place ${towerTypes[state.selectedBuild].name} on clear ground · Esc to cancel`:"Choose a tower below, then click the map to place it";
    updateInspector();
  }
  function updateInspector(){
    const tower=state.selectedTower;
    if(!tower){ui.inspectorTitle.textContent="Tower details";ui.inspectorDesc.textContent="Place a tower or select one on the field to see its stats.";ui.inspectorStats.classList.add("hidden");ui.upgrade.classList.add("hidden");return;}
    const def=towerTypes[tower.type],damage=Math.round(def.damage*Math.pow(1.55,tower.level-1));
    ui.inspectorTitle.textContent=`${def.name} · Level ${tower.level}`;ui.inspectorDesc.textContent=def.desc;
    ui.inspectorStats.classList.remove("hidden");ui.inspectorLevel.textContent=`${tower.level}/4`;ui.inspectorDamage.textContent=damage;
    ui.upgrade.classList.remove("hidden");
    if(tower.level>=4){ui.upgrade.innerHTML="MAX LEVEL";ui.upgrade.disabled=true;}
    else {const cost=Math.round(def.cost*(.62+.48*tower.level));ui.upgrade.innerHTML=`Upgrade <span>$${cost}</span>`;ui.upgrade.disabled=state.cash<cost||state.over;}
  }
  const sharedMaterials=new Set(Object.values(materials));
  function removeVisual(object){
    if(!object)return;object.parent?.remove(object);
    object.traverse(child=>{
      if(child.geometry)child.geometry.dispose();
      if(child.material){const list=Array.isArray(child.material)?child.material:[child.material];list.forEach(material=>{if(sharedMaterials.has(material))return;if(material.map)material.map.dispose();material.dispose();});}
    });
  }
  function clearGroup(group){while(group.children.length)removeVisual(group.children[group.children.length-1]);}
  function mesh(geometry,material,parent,position,scale){
    const item=new THREE.Mesh(geometry,material);item.position.set(position[0],position[1],position[2]);if(scale)item.scale.set(scale[0],scale[1],scale[2]);item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;
  }
  function buildMapScene(){
    clearGroup(worldGroup);const map=currentMap();
    const groundMat=new THREE.MeshStandardMaterial({color:new THREE.Color(map.colors[0]),roughness:.97});
    mesh(new THREE.BoxGeometry(WORLD_W+.5,.42,WORLD_D+.5),new THREE.MeshStandardMaterial({color:0x344336,roughness:.85}),worldGroup,[0,-.32,0]);
    const ground=mesh(new THREE.PlaneGeometry(WORLD_W,WORLD_D),groundMat,worldGroup,[0,-.105,0]);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
    const gridMat=new THREE.LineBasicMaterial({color:0xc3d59c,transparent:true,opacity:.12});const gridPoints=[];
    for(let x=-8;x<=8;x+=1){gridPoints.push(new THREE.Vector3(x,-.095,-5),new THREE.Vector3(x,-.095,5));}
    for(let z=-5;z<=5;z+=1){gridPoints.push(new THREE.Vector3(-8,-.095,z),new THREE.Vector3(8,-.095,z));}
    worldGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPoints),gridMat));
    map.curve=new THREE.CatmullRomCurve3(map.path.map(([x,y])=>toWorld(x,y,.025)),false,"centripetal");
    mesh(new THREE.TubeGeometry(map.curve,240,.43,12,false),materials.roadEdge,worldGroup,[0,0,0]);
    mesh(new THREE.TubeGeometry(map.curve,240,.34,12,false),materials.road,worldGroup,[0,0,0]);
    mesh(new THREE.TubeGeometry(map.curve,240,.012,6,false),materials.roadMark,worldGroup,[0,.015,0]);
    const propGeo=new THREE.SphereGeometry(1,16,12),pineGeo=new THREE.ConeGeometry(1,1.7,9);
    map.props.forEach(([px,py,r],i)=>{
      const p=toWorld(px,py,.06),rad=Math.max(.16,r/W*WORLD_W*.72),clump=new THREE.Group();clump.position.set(p.x,.035,p.z);worldGroup.add(clump);
      mesh(propGeo,new THREE.MeshStandardMaterial({color:new THREE.Color(map.colors[(i+1)%map.colors.length]),roughness:.96}),clump,[-rad*.35,rad*.36,0],[rad*.78,rad*.8,rad*.78]);
      mesh(propGeo,materials.leaves,clump,[rad*.3,rad*.32,-rad*.18],[rad*.74,rad*.74,rad*.72]);
      if(state.mapId==="pinewood"){
        const trunk=mesh(unitCylinder,materials.wood,clump,[0,rad*.52,0],[rad*.15,rad*.8,rad*.15]);trunk.position.y=rad*.45;
        mesh(pineGeo,materials.pine,clump,[0,rad*1.3,0],[rad*.9,rad*1.5,rad*.9]);
        mesh(pineGeo,materials.pine,clump,[0,rad*1.75,0],[rad*.62,rad*1.15,rad*.62]);
      } else {
        mesh(propGeo,materials.leaves,clump,[0,rad*.85,0],[rad*.72,rad*.84,rad*.72]);
      }
      const shadow=mesh(new THREE.CircleGeometry(rad*1.22,20),new THREE.MeshBasicMaterial({color:0x10251a,transparent:true,opacity:.25,depthWrite:false}),clump,[.06,.012,.08]);shadow.rotation.x=-Math.PI/2;
    });
    const endPoint=pointOnPath(pathLength()),end=toWorld(endPoint.x,endPoint.y,.05),base=new THREE.Group();base.position.set(end.x,.04,end.z);base.rotation.y=Math.PI/2-endPoint.angle;worldGroup.add(base);
    mesh(new THREE.CylinderGeometry(.62,.72,.18,12),materials.wood,base,[0,.09,0]);
    const core=mesh(new THREE.IcosahedronGeometry(.32,1),materials.core,base,[0,.55,0]);core.material=materials.core;
    const crystal=mesh(new THREE.OctahedronGeometry(.46,0),new THREE.MeshStandardMaterial({color:0xffe39b,emissive:0xdc9d42,emissiveIntensity:.85,metalness:.3,roughness:.22}),base,[0,.48,0]);
    const ring=mesh(new THREE.TorusGeometry(.52,.045,8,32),materials.gold,base,[0,.27,0]);ring.rotation.x=Math.PI/2;
    worldGroup.userData.core=core;worldGroup.userData.crystal=crystal;worldGroup.userData.base=base;
    createPlacementPreview();
  }
  function createPlacementPreview(){
    if(state.previewGroup)removeVisual(state.previewGroup);
    const group=new THREE.Group();const range=mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:0x96e9a4,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}),group,[0,.045,0]);range.rotation.x=-Math.PI/2;group.userData.range=range;
    const ghost=mesh(new THREE.CylinderGeometry(.22,.29,.14,16),new THREE.MeshStandardMaterial({color:0x9de0ad,transparent:true,opacity:.62,roughness:.5}),group,[0,.1,0]);group.userData.ghost=ghost;
    scene.add(group);state.previewGroup=group;group.visible=false;
  }
  function createTowerModel(tower){
    const group=new THREE.Group(),def=towerTypes[tower.type],color=new THREE.Color(def.color);
    const base=mesh(new THREE.CylinderGeometry(.25,.31,.17,16),new THREE.MeshStandardMaterial({color:0x344a3b,metalness:.22,roughness:.55}),group,[0,.09,0]);
    mesh(new THREE.CylinderGeometry(.08,.12,.45,12),new THREE.MeshStandardMaterial({color:tower.type==="cannon"?0x8c6442:0x667b59,metalness:.2,roughness:.43}),group,[0,.37,0]);
    const head=new THREE.Group();head.position.y=.64;group.add(head);
    if(tower.type==="cannon"){
      mesh(new THREE.SphereGeometry(.25,16,12),new THREE.MeshStandardMaterial({color:0xb98652,metalness:.25,roughness:.36}),head,[0,0,0]);
      const barrel=mesh(new THREE.CylinderGeometry(.12,.16,.56,12),new THREE.MeshStandardMaterial({color:0x4e5146,metalness:.62,roughness:.3}),head,[0,0,.27]);barrel.rotation.x=Math.PI/2;
      mesh(new THREE.TorusGeometry(.15,.035,8,16),materials.gold,head,[0,0,.53]);
    } else if(tower.type==="frost"){
      mesh(new THREE.OctahedronGeometry(.27,1),new THREE.MeshStandardMaterial({color:0x9ce7ff,emissive:0x308fc3,emissiveIntensity:.6,metalness:.2,roughness:.22}),head,[0,.12,0]);
      for(let i=0;i<4;i++){const arm=mesh(new THREE.CylinderGeometry(.025,.025,.48,7),new THREE.MeshStandardMaterial({color:0xc8f5ff,emissive:0x317fa3,emissiveIntensity:.35}),head,[0,0,0]);arm.rotation.z=Math.PI/2;arm.rotation.y=i*Math.PI/4;}
    } else {
      mesh(new THREE.SphereGeometry(.21,14,12),new THREE.MeshStandardMaterial({color:color,emissive:color,emissiveIntensity:.12,metalness:.24,roughness:.35}),head,[0,0,0]);
      const barrelLength=tower.type==="sniper"?.82:.53,barrel=mesh(new THREE.CylinderGeometry(tower.type==="sniper"?.045:.065,tower.type==="sniper"?.07:.09,barrelLength,10),new THREE.MeshStandardMaterial({color:tower.type==="sniper"?0x514b39:0x405a43,metalness:.35,roughness:.36}),head,[0,0,barrelLength*.48]);barrel.rotation.x=Math.PI/2;
      if(tower.type==="archer")mesh(new THREE.TorusGeometry(.22,.028,7,20,Math.PI),new THREE.MeshStandardMaterial({color:0xd9c58a,metalness:.2,roughness:.5}),head,[0,0,.02]);
    }
    const range=mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:0x9ce5a8,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}),entityGroup,[0,.03,0]);range.rotation.x=-Math.PI/2;range.visible=false;
    const levelPips=new THREE.Group();group.add(levelPips);
    for(let i=0;i<3;i++){const pip=mesh(new THREE.SphereGeometry(.045,8,6),materials.gold,levelPips,[-.18+i*.18,.12,-.25]);pip.visible=i<tower.level-1;}
    group.position.copy(toWorld(tower.x,tower.y,0));group.userData.head=head;group.userData.range=range;group.userData.pips=levelPips;
    entityGroup.add(group);tower.mesh=group;tower.rangeMesh=range;
    return group;
  }
  function createEnemyModel(enemy){
    const group=new THREE.Group(),def=enemyTypes[enemy.type],color=new THREE.Color(def.color);
    const bodyMaterial=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.1,roughness:.37,metalness:.08});
    if(enemy.type==="runner"){
      mesh(new THREE.ConeGeometry(.19,.48,7),bodyMaterial,group,[0,.29,0]);
      mesh(new THREE.SphereGeometry(.1,10,8),new THREE.MeshStandardMaterial({color:0xffe2a9}),group,[0,.48,.02]);
    } else if(enemy.type==="brute"){
      mesh(new THREE.DodecahedronGeometry(.32,1),bodyMaterial,group,[0,.32,0]);
      mesh(new THREE.SphereGeometry(.12,10,8),new THREE.MeshStandardMaterial({color:0xffd7a6}),group,[0,.52,.16]);
    } else if(enemy.type==="shield"){
      mesh(new THREE.IcosahedronGeometry(.26,1),bodyMaterial,group,[0,.31,0]);
      const shield=mesh(new THREE.CylinderGeometry(.32,.32,.07,16),new THREE.MeshStandardMaterial({color:0xa6dfff,transparent:true,opacity:.55,metalness:.3}),group,[0,.35,0]);shield.rotation.x=Math.PI/2;
    } else if(enemy.type==="boss"){
      mesh(new THREE.DodecahedronGeometry(.45,1),bodyMaterial,group,[0,.48,0]);
      for(const side of [-1,1]){const horn=mesh(new THREE.ConeGeometry(.13,.39,7),materials.gold,group,[side*.28,.94,0]);horn.rotation.z=side*.45;}
      const ring=mesh(new THREE.TorusGeometry(.53,.035,8,24),new THREE.MeshStandardMaterial({color:0xff99bd,emissive:0xa42d55,emissiveIntensity:.55}),group,[0,.25,0]);ring.rotation.x=Math.PI/2;
    } else {
      mesh(new THREE.SphereGeometry(enemy.type==="scout"?.22:.25,16,12),bodyMaterial,group,[0,.28,0]);
      mesh(new THREE.SphereGeometry(.1,10,8),new THREE.MeshStandardMaterial({color:0xffe3bf}),group,[0,.42,.13]);
    }
    const barBg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x182119,depthWrite:false}));barBg.scale.set(.52,.075,1);barBg.position.set(0,enemy.type==="boss"?1.35:.82,0);group.add(barBg);
    const bar=new THREE.Sprite(new THREE.SpriteMaterial({color:0x9ee185,depthWrite:false}));bar.scale.set(.49,.045,1);bar.position.set(0,barBg.position.y,.012);group.add(bar);
    group.userData.healthBar=bar;group.userData.healthBarWidth=.49;group.position.copy(toWorld(enemy.x,enemy.y,0));entityGroup.add(group);enemy.mesh=group;
  }
  function setMap(id){
    state.mapId=id;const map=maps[id];ui.mapTitle.textContent=map.name;ui.mapSubtitle.textContent=map.subtitle;ui.mapTag.textContent=map.tag;
    document.querySelectorAll(".map-choice").forEach(btn=>btn.classList.toggle("selected",btn.dataset.map===id));
    const begin=document.getElementById("begin-btn");begin.innerHTML=`Deploy to ${map.name} <span>→</span>`;
  }
  function resetGame(){
    clearGroup(entityGroup);clearGroup(effectGroup);
    state.started=false;state.over=false;state.paused=false;state.speed=1;state.cash=420;state.health=25;state.maxHealth=25;
    state.wave=0;state.kills=0;state.waveActive=false;state.queue=[];state.spawnTimer=0;state.enemies=[];state.towers=[];state.bullets=[];state.particles=[];state.floaters=[];
    state.selectedBuild=null;state.selectedTower=null;state.coreFlash=0;ui.speedBtn.disabled=true;report("The road is clear. Build towers before you call the first wave.");updateHud();
  }
  function startWave(){
    if(!state.started||state.waveActive||state.over)return;
    state.wave++;state.waveActive=true;state.paused=false;state.queue=[];
    const count=7+state.wave*3;
    for(let i=0;i<count;i++){
      let type="scout";
      const roll=Math.random();
      if(state.wave>=2&&roll<.19)type="runner";
      else if(state.wave>=3&&roll>.78&&roll<.91)type="brute";
      else if(state.wave>=4&&roll>=.91)type="shield";
      state.queue.push(type);
    }
    if(state.wave%5===0)state.queue.push("boss");
    state.spawnTimer=.25;report(`Wave ${state.wave} is on the road. Keep your core protected.`);toast(`WAVE ${state.wave} · Enemies inbound`);
    ui.banner.textContent=`WAVE ${state.wave}`;ui.banner.classList.remove("show");void ui.banner.offsetWidth;ui.banner.classList.add("show");updateHud();
  }
  function makeEnemy(type){
    const def=enemyTypes[type],scale=1+(state.wave-1)*.14;
    const enemy={type,x:0,y:0,progress:0,hp:Math.round(def.health*scale),maxHp:Math.round(def.health*scale),speed:def.speed*(1+Math.min(.24,(state.wave-1)*.025)),reward:def.reward+Math.floor(state.wave*.8),baseDamage:def.damage,radius:def.radius,armor:def.armor||0,slowTimer:0,slowFactor:1,alive:true,phase:Math.random()*6.28};
    state.enemies.push(enemy);createEnemyModel(enemy);
  }
  function addBurst(x,y,color,count=10){
    const tint=new THREE.Color(color);
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,s=30+Math.random()*130,geometry=new THREE.SphereGeometry(.035+Math.random()*.035,7,6),material=new THREE.MeshBasicMaterial({color:tint,transparent:true});
      const spark=mesh(geometry,material,effectGroup,[0,0,0]);spark.position.copy(toWorld(x,y,.28+Math.random()*.34));
      state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.45,max:.8,r:2+Math.random()*3,color,mesh:spark});
    }
  }
  function killEnemy(enemy){
    if(!enemy.alive)return;enemy.alive=false;state.cash+=enemy.reward;state.kills++;addBurst(enemy.x,enemy.y,enemyTypes[enemy.type].color,enemy.type==="boss"?24:11);
    if(enemy.mesh)removeVisual(enemy.mesh);
    floatText(enemy.x,enemy.y-15,`+$${enemy.reward}`,"#f3d27d");report(`${enemyTypes[enemy.type].name} defeated · +$${enemy.reward}`);updateHud();
  }
  function leakEnemy(enemy){
    if(!enemy.alive)return;enemy.alive=false;state.health=Math.max(0,state.health-enemy.baseDamage);state.coreFlash=.65;
    if(enemy.mesh)removeVisual(enemy.mesh);
    const msg=`${enemyTypes[enemy.type].name} reached the core · -${enemy.baseDamage} health`;
    report(msg);toast(msg);floatText(905,pointOnPath(pathLength()).y-32,`-${enemy.baseDamage} CORE`,"#ff9685");addBurst(905,pointOnPath(pathLength()).y,"#ff765f",18);updateHud();
    if(state.health<=0)endGame();
  }
  function endGame(){
    state.over=true;state.paused=true;state.waveActive=false;document.getElementById("gameover-copy").textContent=`Your defence held for ${state.wave} ${state.wave===1?"wave":"waves"} and stopped ${state.kills} enemies. Try a different tower setup and defend the core again.`;
    ui.gameover.classList.remove("hidden");report("Core offline. Your defence has ended.");updateHud();
  }
  function towerStats(tower){
    const def=towerTypes[tower.type],factor=Math.pow(1.55,tower.level-1);
    return{damage:def.damage*factor,range:def.range*(1+.09*(tower.level-1)),rate:def.rate/Math.pow(1.12,tower.level-1),projectile:def.projectile,splash:def.splash||0,slow:def.slow||0,kind:def.kind,color:def.color};
  }
  function fireTower(tower,target,stats){
    tower.cooldown=stats.rate;const dx=target.x-tower.x,dy=target.y-tower.y;tower.angle=Math.atan2(dy,dx);
    const bullet={x:tower.x+dx*.18,y:tower.y+dy*.18,target,speed:stats.projectile,damage:stats.damage,kind:stats.kind,color:stats.color,splash:stats.splash,slow:stats.slow,life:2};
    const color=new THREE.Color(stats.color),geo=new THREE.SphereGeometry(stats.kind==="blast"?.105:.065,10,8),mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.1,roughness:.25});
    bullet.mesh=mesh(geo,mat,entityGroup,[0,0,0]);bullet.mesh.position.copy(toWorld(bullet.x,bullet.y,.48));state.bullets.push(bullet);
    tower.recoil=.12;
  }
  function damageEnemy(enemy,damage,kind,slow){
    if(!enemy.alive)return;
    const dealt=Math.max(1,damage*(1-enemy.armor));enemy.hp-=dealt;
    if(slow){enemy.slowTimer=1.8;enemy.slowFactor=Math.min(enemy.slowFactor,slow);}
    if(enemy.hp<=0)killEnemy(enemy);else if(kind==="sniper")floatText(enemy.x,enemy.y-16,`-${Math.round(dealt)}`,"#fff0c1");
  }
  function update(dt){
    if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)ui.toast.classList.remove("show");}
    state.coreFlash=Math.max(0,state.coreFlash-dt);
    state.particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.04,dt);p.vy*=Math.pow(.04,dt);if(p.mesh){p.mesh.position.copy(toWorld(p.x,p.y,.35+Math.max(0,p.life)*.45));p.mesh.scale.setScalar(Math.max(.05,p.life/p.max));p.mesh.material.opacity=Math.max(0,p.life/p.max);}});
    const expiredParticles=state.particles.filter(p=>p.life<=0);expiredParticles.forEach(p=>{if(p.mesh){effectGroup.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}});state.particles=state.particles.filter(p=>p.life>0);
    state.floaters.forEach(f=>{f.life-=dt;f.y-=27*dt;if(f.mesh){f.mesh.position.copy(toWorld(f.x,f.y,.72));f.mesh.material.opacity=Math.max(0,f.life/f.max);}});
    const expiredFloaters=state.floaters.filter(f=>f.life<=0);expiredFloaters.forEach(f=>{effectGroup.remove(f.mesh);f.mesh.material.map.dispose();f.mesh.material.dispose();});state.floaters=state.floaters.filter(f=>f.life>0);
    if(!state.started||state.paused||state.over)return;
    const step=dt*state.speed;
    if(state.waveActive){
      state.spawnTimer-=step;
      if(state.queue.length&&state.spawnTimer<=0){makeEnemy(state.queue.shift());state.spawnTimer=Math.max(.48,.9-state.wave*.018);}
      for(const enemy of state.enemies){if(!enemy.alive)continue;
        if(enemy.slowTimer>0){enemy.slowTimer-=step;if(enemy.slowTimer<=0)enemy.slowFactor=1;}
        enemy.progress+=enemy.speed*enemy.slowFactor*step;const pos=pointOnPath(enemy.progress);enemy.x=pos.x;enemy.y=pos.y+Math.sin(performance.now()*.006+enemy.phase)*1.5;
        if(enemy.mesh){enemy.mesh.position.copy(toWorld(enemy.x,enemy.y,0));enemy.mesh.rotation.y=-performance.now()*.00035;const bar=enemy.mesh.userData.healthBar,fraction=Math.max(.025,enemy.hp/enemy.maxHp),barWidth=enemy.mesh.userData.healthBarWidth;bar.scale.x=barWidth*fraction;bar.position.x=-(barWidth-bar.scale.x)/2;bar.material.color.setHex(fraction<.3?0xf07769:enemy.slowTimer>0?0x8de6ff:0x9ee185);}
        if(enemy.progress>=pathLength())leakEnemy(enemy);
      }
      state.enemies.filter(e=>!e.alive&&e.mesh).forEach(e=>entityGroup.remove(e.mesh));
      state.enemies=state.enemies.filter(e=>e.alive);
      for(const tower of state.towers){
        tower.cooldown=Math.max(0,tower.cooldown-step);tower.recoil=Math.max(0,(tower.recoil||0)-step);
        if(tower.cooldown>0)continue;
        const stats=towerStats(tower),targets=state.enemies.filter(e=>e.alive&&Math.hypot(e.x-tower.x,e.y-tower.y)<=stats.range);
        targets.sort((a,b)=>b.progress-a.progress);
        if(targets.length)fireTower(tower,targets[0],stats);
      }
      for(const bullet of state.bullets){
        bullet.life-=step;const target=bullet.target;
        if(!target.alive){bullet.life=0;continue;}
        const dx=target.x-bullet.x,dy=target.y-bullet.y,d=Math.hypot(dx,dy),move=bullet.speed*step;
        if(d<=move+target.radius+3){
          addBurst(target.x,target.y,bullet.color,bullet.kind==="blast"?15:5);
          if(bullet.splash){for(const e of state.enemies)if(e.alive&&Math.hypot(e.x-target.x,e.y-target.y)<bullet.splash)damageEnemy(e,bullet.damage,bullet.kind,bullet.slow);}
          else damageEnemy(target,bullet.damage,bullet.kind,bullet.slow);
          bullet.life=0;
        }else{bullet.x+=dx/d*move;bullet.y+=dy/d*move;}
        if(bullet.mesh){bullet.mesh.position.copy(toWorld(bullet.x,bullet.y,.48+Math.sin(performance.now()*.02)*.025));if(bullet.kind==="blast")bullet.mesh.rotation.x+=step*4;}
      }
      state.bullets.filter(b=>b.life<=0).forEach(b=>removeVisual(b.mesh));
      state.bullets=state.bullets.filter(b=>b.life>0);
      state.towers.forEach(t=>{if(t.rangeMesh)t.rangeMesh.visible=state.selectedTower===t;if(t.mesh){t.mesh.position.copy(toWorld(t.x,t.y,0));t.mesh.userData.head.rotation.y=Math.PI/2-(t.angle||0);t.mesh.userData.pips.children.forEach((pip,i)=>pip.visible=i<t.level-1);}});
      if(worldGroup.userData.crystal){worldGroup.userData.crystal.rotation.y+=step*.7;worldGroup.userData.crystal.position.y=.48+Math.sin(performance.now()*.002)*.035;}
      if(!state.queue.length&&!state.enemies.length){
        state.waveActive=false;state.cash+=45+state.wave*7;const bonus=45+state.wave*7;
        report(`Wave ${state.wave} cleared · supply bonus +$${bonus}. Prepare for the next wave.`);toast(`Wave cleared · +$${bonus} supply bonus`);updateHud();
      }
    }
  }
  function validPlacement(x,y,type){
    if(!state.started||state.over||!type||x<30||x>W-35||y<35||y>H-35)return false;
    if(state.cash<towerTypes[type].cost||distanceToPath(x,y)<54)return false;
    if(Math.hypot(x-pointOnPath(pathLength()).x,y-pointOnPath(pathLength()).y)<62)return false;
    return state.towers.every(t=>Math.hypot(x-t.x,y-t.y)>42);
  }
  function pointerPosition3D(event){
    const rect=canvas.getBoundingClientRect();pointerNdc.set((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height*2-1));
    raycaster.setFromCamera(pointerNdc,camera);const hit=raycaster.ray.intersectPlane(groundPlane,worldPoint);
    return hit?toLogical(hit):{x:-100,y:-100};
  }
  function render3D(){
    const time=performance.now()*.001;
    state.towers.forEach(tower=>{
      if(!tower.mesh)return;tower.mesh.position.copy(toWorld(tower.x,tower.y,0));
      tower.mesh.userData.head.rotation.y=Math.PI/2-(tower.angle||0);
      tower.mesh.userData.head.position.y=.64-(tower.recoil||0)*.42;
      tower.mesh.userData.pips.children.forEach((pip,i)=>pip.visible=i<tower.level-1);
      tower.rangeMesh.visible=state.selectedTower===tower;
      const radius=towerStats(tower).range/W*WORLD_W,point=toWorld(tower.x,tower.y,.035);
      tower.rangeMesh.scale.set(radius,radius,1);tower.rangeMesh.position.set(point.x,.035,point.z);
    });
    state.enemies.forEach(enemy=>{if(enemy.mesh){enemy.mesh.position.copy(toWorld(enemy.x,enemy.y,0));enemy.mesh.position.y+=Math.sin(time*4+enemy.phase)*.025;const bar=enemy.mesh.userData.healthBar,fraction=Math.max(.025,enemy.hp/enemy.maxHp),barWidth=enemy.mesh.userData.healthBarWidth;bar.scale.x=barWidth*fraction;bar.position.x=-(barWidth-bar.scale.x)/2;bar.material.color.setHex(fraction<.3?0xf07769:enemy.slowTimer>0?0x8de6ff:0x9ee185);}});
    if(worldGroup.userData.crystal){worldGroup.userData.crystal.rotation.y=time*.7;worldGroup.userData.crystal.position.y=.48+Math.sin(time*2)*.035;worldGroup.userData.crystal.material.emissiveIntensity=state.coreFlash>0?2.3:1.15;}
    if(state.previewGroup){
      const visible=state.started&&!state.over&&Boolean(state.selectedBuild)&&state.pointer.x>=0&&state.pointer.x<=W&&state.pointer.y>=0&&state.pointer.y<=H;
      state.previewGroup.visible=visible;
      if(visible){const p=toWorld(state.pointer.x,state.pointer.y,.05),valid=validPlacement(state.pointer.x,state.pointer.y,state.selectedBuild),def=towerTypes[state.selectedBuild],radius=def.range/W*WORLD_W;
        state.previewGroup.position.set(p.x,.025,p.z);state.previewGroup.userData.range.scale.set(radius,radius,1);
        const tint=valid?0x9ce8a5:0xf17c70;state.previewGroup.userData.range.material.color.setHex(tint);state.previewGroup.userData.ghost.material.color.setHex(tint);
      }
    }
    renderer.render(scene,camera);
  }
  function resize3D(){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const aspect=rect.width/rect.height,viewHeight=12.8*Math.max(1,1.6/aspect);
    camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.setSize(rect.width,rect.height,false);
  }

  canvas.addEventListener("pointermove",event=>{state.pointer=pointerPosition3D(event);});
  canvas.addEventListener("pointerleave",()=>{state.pointer={x:-100,y:-100};});
  canvas.addEventListener("pointerdown",event=>{
    if(!state.started||state.over)return;const p=pointerPosition3D(event);if(p.x<0||p.y<0||p.x>W||p.y>H)return;
    const tower=state.towers.slice().reverse().find(t=>Math.hypot(t.x-p.x,t.y-p.y)<23);
    if(tower){state.selectedTower=tower;state.selectedBuild=null;updateHud();return;}
    if(state.selectedBuild){
      if(!validPlacement(p.x,p.y,state.selectedBuild)){toast(state.cash<towerTypes[state.selectedBuild].cost?"Not enough cash for this tower":"Choose open ground away from the road and other towers");return;}
      const type=state.selectedBuild;state.cash-=towerTypes[type].cost;state.selectedTower={type,x:p.x,y:p.y,level:1,cooldown:.2,angle:-Math.PI/2,recoil:0};state.towers.push(state.selectedTower);createTowerModel(state.selectedTower);
      report(`${towerTypes[type].name} tower placed. It will target enemies in range.`);toast(`${towerTypes[type].name} tower placed`);state.selectedBuild=null;updateHud();return;
    }
    state.selectedTower=null;updateHud();
  });

  document.querySelectorAll(".tower-option").forEach(btn=>btn.addEventListener("click",()=>{
    const type=btn.dataset.tower;if(state.cash<towerTypes[type].cost){toast(`Need $${towerTypes[type].cost} to place ${towerTypes[type].name}`);return;}
    state.selectedBuild=state.selectedBuild===type?null:type;state.selectedTower=null;updateHud();
  }));
  ui.waveBtn.addEventListener("click",startWave);
  document.getElementById("rotate-view-btn").addEventListener("click",()=>{
    cameraAngle=(cameraAngle+Math.PI/2)%(Math.PI*2);const radius=18.4;
    camera.position.set(Math.cos(cameraAngle)*radius,11,Math.sin(cameraAngle)*radius);camera.lookAt(0,0,0);
  });
  ui.speedBtn.addEventListener("click",()=>{
    if(!state.waveActive)return;state.speed=state.speed===1?2:1;updateHud();
  });
  ui.pauseBtn.addEventListener("click",()=>{if(!state.waveActive)return;state.paused=!state.paused;updateHud();});
  ui.upgrade.addEventListener("click",()=>{
    const tower=state.selectedTower;if(!tower||tower.level>=4)return;const def=towerTypes[tower.type],cost=Math.round(def.cost*(.62+.48*tower.level));
    if(state.cash<cost){toast(`Need $${cost} to upgrade this tower`);return;}
    state.cash-=cost;tower.level++;report(`${def.name} upgraded to level ${tower.level} · damage increased.`);toast(`${def.name} upgraded · Level ${tower.level}`);addBurst(tower.x,tower.y,"#f3da91",16);updateHud();
  });
  document.querySelectorAll(".map-choice").forEach(btn=>btn.addEventListener("click",()=>{setMap(btn.dataset.map);buildMapScene();}));
  document.getElementById("begin-btn").addEventListener("click",()=>{resetGame();state.started=true;ui.setup.classList.add("hidden");toast(`${currentMap().name} · Build your defence`);updateHud();});
  document.getElementById("retry-btn").addEventListener("click",()=>{ui.gameover.classList.add("hidden");resetGame();state.started=true;toast("Fresh defence line · Good luck");});
  window.addEventListener("keydown",event=>{
    if(event.key==="Escape"){state.selectedBuild=null;state.selectedTower=null;updateHud();}
    if(event.code==="Space"&&state.started&&!state.over){event.preventDefault();if(state.waveActive){state.paused=!state.paused;updateHud();}else startWave();}
  });
  let last=performance.now();
  function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render3D();}
  setMap("harbour");buildMapScene();updateHud();resize3D();window.addEventListener("resize",resize3D);
  if(window.ResizeObserver)new ResizeObserver(resize3D).observe(canvas.parentElement);
  requestAnimationFrame(frame);
})();
