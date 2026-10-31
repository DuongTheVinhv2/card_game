/** A painted, side-on ruined hall. Deliberately flat, without perspective geometry. */
export function paintDungeon():HTMLCanvasElement {
  const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;const c=cv.getContext('2d')!;
  const g=c.createLinearGradient(0,0,0,1080);g.addColorStop(0,'#172229');g.addColorStop(.6,'#344342');g.addColorStop(1,'#242a2a');c.fillStyle=g;c.fillRect(0,0,1920,1080);
  const path=(d:string,fill:string,stroke='#182023',lw=4)=>{const p=new Path2D(d);c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=lw;c.fill(p);c.stroke(p);};
  // Masonry courses, recessed arches and a low, misty tree line.
  for(let row=0;row<8;row++)for(let col=-1;col<13;col++){
    const x=col*173+(row%2)*86,y=row*92;c.fillStyle=row%3===0?'#344242':'#2d3a3b';c.strokeStyle='#202c30';c.lineWidth=3;c.fillRect(x,y,171,90);c.strokeRect(x,y,171,90);
  }
  for(const x of [220,680,1140,1600]){
    path(`M${x-115} 695 L${x-115} 300 Q${x} 65 ${x+115} 300 L${x+115} 695Z`,'#17292e','#435352',15);
    path(`M${x-82} 685 L${x-82} 313 Q${x} 143 ${x+82} 313 L${x+82} 685Z`,'#21373a','#111e26',4);
    c.save();c.beginPath();c.rect(x-78,300,156,390);c.clip();
    for(let j=0;j<5;j++)path(`M${x-100+j*44} 700 L${x-55+j*36} 375 ${x-38+j*40} 700Z`,'#263e3e','#263e3e');
    c.restore();
  }
  for(const x of [12,450,910,1370,1830]){
    path(`M${x} 120 L${x+67} 120 ${x+76} 731 ${x-9} 731Z`,'#46463d','#202a2c',6);
    path(`M${x+13} 132 L${x+29} 132 ${x+28} 716 ${x+9} 716Z`,'#626051','#626051',1);
    path(`M${x-21} 110 L${x+88} 110 ${x+76} 150 ${x-10} 150Z`,'#69614e');
    path(`M${x-19} 709 L${x+87} 709 ${x+98} 751 ${x-28} 751Z`,'#555343');
    // Iron sconces with warm pools of light, painted into the backdrop.
    const glow=c.createRadialGradient(x+37,430,5,x+37,430,170);glow.addColorStop(0,'#e8ad493d');glow.addColorStop(1,'#e8ad4900');c.fillStyle=glow;c.fillRect(x-140,250,350,360);
    path(`M${x+22} 454 L${x+52} 454 ${x+47} 493 ${x+28} 493Z`,'#282c2a');
    path(`M${x+37} 455 Q${x+13} 438 ${x+36} 400 Q${x+33} 426 ${x+48} 431 Q${x+57} 445 ${x+37} 455Z`,'#c68b46','#6c5335',2);
    path(`M${x+37} 450 Q${x+28} 439 ${x+39} 423 Q${x+48} 442 ${x+37} 450Z`,'#efd196','#efd196',1);
  }
  // Flat stone platform with broken paving and tiny weeds.
  path('M0 680 Q430 672 960 682 T1920 678 L1920 1080 0 1080Z','#4c4b40','#242f30',7);
  for(let row=0;row<5;row++)for(let col=-1;col<11;col++){
    const x=col*203+(row%2)*98,y=690+row*82;
    path(`M${x} ${y} L${x+190} ${y-4} ${x+199} ${y+69} ${x-6} ${y+75}Z`,['#535448','#484d44','#5e5b4a'][(col+row+12)%3],'#323d38',3);
  }
  for(let i=0;i<35;i++){const x=(i*139+57)%1920,y=685+(i*41)%290;c.strokeStyle='#697555';c.lineWidth=2;c.beginPath();c.moveTo(x,y+10);c.lineTo(x-4,y-8);c.moveTo(x,y+10);c.lineTo(x+7,y-4);c.stroke();}
  // Paper grain, deterministic so frames do not shimmer.
  let seed=231;for(let i=0;i<21000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%1920;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%1080;c.fillStyle=i%2?'#f6dfaa05':'#0713170a';c.fillRect(x,y,2,2);}
  const shade=c.createRadialGradient(1000,490,200,1000,490,1100);shade.addColorStop(0,'#07101400');shade.addColorStop(1,'#071014c7');c.fillStyle=shade;c.fillRect(0,0,1920,1080);
  return cv;
}
