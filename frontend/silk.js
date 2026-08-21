(()=>{const canvas=document.getElementById('silk');if(!canvas)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){canvas.style.display='none';return}const gl=canvas.getContext('webgl',{alpha:false,antialias:false});if(!gl){canvas.style.display='none';return}const vertex='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';const fragment=`
// "Silk" — made with the 21st.dev Shader Builder
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 u_colors[8];
uniform vec4 u_scene;
uniform vec4 u_shape;
uniform vec4 u_surface;
uniform vec4 u_finish;
uniform vec4 u_transform;
uniform vec4 u_space;
uniform vec4 u_cursor;
#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_paramA u_shape.z
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define u_seed u_transform.x
#else
#define u_seed mod(u_transform.x,31.0)
#endif
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_oklab u_transform.w
#define u_offset u_space.xy
#define u_mouse u_space.zw
#define u_cursorPresence u_cursor.x
#define u_cursorEffect u_cursor.y
#define u_cursorStrength u_cursor.z
#define u_cursorRadius u_cursor.w
float hash21(vec2 p){
#ifndef GL_FRAGMENT_PRECISION_HIGH
p=mod(p,31.0);
#endif
p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float grainHash(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){
#ifndef GL_FRAGMENT_PRECISION_HIGH
p=mod(p,31.0);
#endif
float n=sin(dot(p,vec2(41.0,289.0)));return fract(vec2(15731.743,7892.321)*n);}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),u.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.,9.2);a*=.5;}return v;}
vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
vec3 linearToSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(.0031308,c));}
vec3 linToOklab(vec3 c){float l=.4122214708*c.r+.5363325363*c.g+.0514459929*c.b;float m=.2119034982*c.r+.6806995451*c.g+.1073969566*c.b;float s=.0883024619*c.r+.2817188376*c.g+.6299787005*c.b;l=pow(max(l,0.),1./3.);m=pow(max(m,0.),1./3.);s=pow(max(s,0.),1./3.);return vec3(.2104542553*l+.7936177850*m-.0040720468*s,1.9779984951*l-2.4285922050*m+.4505937099*s,.0259040371*l+.7827717662*m-.8086757660*s);}
vec3 oklabToLin(vec3 c){float l=c.x+.3963377774*c.y+.2158037573*c.z;float m=c.x-.1055613458*c.y-.0638541728*c.z;float s=c.x-.0894841775*c.y-1.2914855480*c.z;l=l*l*l;m=m*m*m;s=s*s*s;return vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s);}
vec3 mixColour(vec3 a,vec3 b,float t){if(u_oklab>.5){vec3 la=linToOklab(srgbToLinear(a));vec3 lb=linToOklab(srgbToLinear(b));return clamp(linearToSrgb(oklabToLin(mix(la,lb,t))),0.,1.);}return mix(a,b,t);}
vec3 palette(float x){float n=max(u_colorCount-1.,1.);float f=clamp(x,0.,1.)*n;vec3 col=u_colors[0];for(int i=0;i<7;i++){if(float(i)<n)col=mixColour(col,u_colors[i+1],smoothstep(0.,1.,clamp(f-float(i),0.,1.)));}return col;}
vec3 hueRotate(vec3 col,float a){const mat3 toYIQ=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312);const mat3 toRGB=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);vec3 yiq=toYIQ*col;float ca=cos(a),sa=sin(a);yiq=vec3(yiq.x,yiq.y*ca-yiq.z*sa,yiq.y*sa+yiq.z*ca);return toRGB*yiq;}
vec3 shade(vec2 uv,vec2 p,float t){vec2 q=p*1.6;float amp=.25+u_intensity*.85;for(float i=1.;i<5.;i+=1.){q.x+=amp/i*cos(i*2.4*q.y+t*.8+u_seed);q.y+=amp/i*cos(i*1.7*q.x+t*.6);}return palette(.5+.5*sin(q.x+q.y));}
void main(){vec2 uv=gl_FragCoord.xy/u_resolution.xy;vec2 screenUv=uv;vec2 p=(gl_FragCoord.xy-.5*u_resolution.xy)/min(u_resolution.x,u_resolution.y);float cursorMask=0.;if(u_cursorPresence>.001){vec2 cursor=(.5*u_mouse*u_resolution.xy)/min(u_resolution.x,u_resolution.y);vec2 cursorDelta=p-cursor;if(u_cursorEffect<.5){p+=cursor*u_cursorPresence*u_cursorStrength*.55;}else{float cursorDistance=length(cursorDelta);vec2 cursorDirection=cursorDelta/max(cursorDistance,.0001);cursorMask=u_cursorPresence*(1.-smoothstep(0.,u_cursorRadius,cursorDistance));if(u_cursorEffect<1.5){p-=cursorDirection*cursorMask*u_cursorStrength*.24;}else if(u_cursorEffect<2.5){float cursorAngle=cursorMask*u_cursorStrength*2.2;float cc=cos(cursorAngle),cs=sin(cursorAngle);p=cursor+mat2(cc,-cs,cs,cc)*cursorDelta;}else if(u_cursorEffect<3.5){float ripple=sin(cursorDistance/max(u_cursorRadius,.001)*18.-u_time*5.);p-=cursorDirection*ripple*cursorMask*u_cursorStrength*.07;}}}uv=p*min(u_resolution.x,u_resolution.y)/u_resolution.xy+.5;p*=u_scale;if(abs(u_rotate)>.0001){float cr=cos(u_rotate),sr=sin(u_rotate);p=mat2(cr,-sr,sr,cr)*p;}p+=u_offset;if(u_drift>.0001)p+=u_drift*vec2(sin(u_time*.31),cos(u_time*.23));if(u_warp>0.)p+=u_warp*(vec2(fbm(p*u_detail+u_seed),fbm(p*u_detail+vec2(5.2,1.3)))-.5);vec3 col;if(u_blur>0.){float e=u_blur;float pe=e*u_scale;vec2 uvE=vec2(e)*min(u_resolution.x,u_resolution.y)/u_resolution.xy;col=shade(uv,p,u_time)*.36;col+=shade(uv+vec2(uvE.x,0.),p+vec2(pe,0.),u_time)*.16;col+=shade(uv-vec2(uvE.x,0.),p-vec2(pe,0.),u_time)*.16;col+=shade(uv+vec2(0.,uvE.y),p+vec2(0.,pe),u_time)*.16;col+=shade(uv-vec2(0.,uvE.y),p-vec2(0.,pe),u_time)*.16;}else col=shade(uv,p,u_time);if(abs(u_contrast-1.)>.0001)col=(col-.5)*u_contrast+.5;if(abs(u_saturation-1.)>.0001){float luma=dot(col,vec3(.299,.587,.114));col=mix(vec3(luma),col,u_saturation);}if(abs(u_hue)>.0001)col=hueRotate(col,u_hue);if(abs(u_brightness)>.0001)col+=u_brightness;if(u_vignette>.0001){float vd=length(screenUv-.5)*1.41421356;col*=1.-u_vignette*smoothstep(.35,1.,vd);}if(u_cursorPresence>.001&&u_cursorEffect>3.5)col+=(vec3(.18)+col*.12)*cursorMask*u_cursorStrength;if(u_grain>.0001)col+=(grainHash(gl_FragCoord.xy+vec2(u_seed*17.,u_seed*31.))-.5)*u_grain;gl_FragColor=vec4(clamp(col,0.,1.),1.);}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}try{const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);const loc=name=>gl.getUniformLocation(program,name);gl.uniform3fv(loc('u_colors[0]'),new Float32Array([.008,.004,.039,.016,.020,.180,.239,.173,.553,.569,.420,.749,0,0,0,0,0,0,0,0,0,0,0,0]));gl.uniform4f(loc('u_shape'),1.26,.28,.50,0);gl.uniform4f(loc('u_surface'),2.40,1.11,0,1);gl.uniform4f(loc('u_finish'),0,0,0,.05);gl.uniform4f(loc('u_transform'),1581,0,0,0);gl.uniform4f(loc('u_space'),0,0,0,0);gl.uniform4f(loc('u_cursor'),0,2,.65,.46);let raf=0,start=performance.now();function draw(now){const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}gl.uniform4f(loc('u_scene'),w,h,(now-start)/1000*.76,4);gl.drawArrays(gl.TRIANGLES,0,3);raf=requestAnimationFrame(draw)}function visibility(){cancelAnimationFrame(raf);if(!document.hidden){start=performance.now();raf=requestAnimationFrame(draw)}}document.addEventListener('visibilitychange',visibility);raf=requestAnimationFrame(draw)}catch(error){console.warn('Silk fallback:',error);canvas.style.display='none'}})();
