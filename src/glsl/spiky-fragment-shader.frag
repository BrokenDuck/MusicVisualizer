precision highp float;

#define SPIKE_NUM 32 // Set to FFT_SIZE/64
#define COLOR_NUM 12 // Constant
#define NUM_OCTAVES 5 // For brownian noise


uniform float uTime;
uniform float uSpikeSize[SPIKE_NUM];
uniform float uColors[COLOR_NUM];

in float vDisplacement;
in vec2 vUv;
in vec3 vPosition;

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}


float fbm(vec3 x) {
	float v = 0.0;
	float a = 0.5;
	vec3 shift = vec3(100);
	for (int i = 0; i < NUM_OCTAVES; ++i) {
		v += a * noise(x);
		x = x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}

// ColorStop Point data structure for the COLOR_RAMP macro 
// color -> the color of the color stop
// position -> position of the color stop on the color ramp -> [0, 1]

struct ColorStop {
    vec3 color;
    float position; // Range from 0 to 1
};

// COLOR_RAMP macro by Arya Ross -> based on Blender's ColorRamp Node in the shading tab
// ColorStop[?] colors -> array of color stops that can have any length
// float factor -> the position that you want to know the color of -> [0, 1]
// vec3 finalColor -> the final color based on the factor 

// Line 5 Of The Macro:
// // possibly is bad for performance 
// index = isInBetween ? i : index; \

// Taken From: https://stackoverflow.com/a/26219603/19561482 
// index = int(mix(float(index), float(i), float(isInBetween)))

#define COLOR_RAMP(colors, factor, finalColor) { \
    int index = 0; \
    for(int i = 0; i < colors.length() - 1; i++){ \
       ColorStop currentColor = colors[i]; \
       bool isInBetween = currentColor.position <= factor; \
       index = int(mix(float(index), float(i), float(isInBetween))); \
    } \
    ColorStop currentColor = colors[index]; \
    ColorStop nextColor = colors[index + 1]; \
    float range = nextColor.position - currentColor.position; \
    float lerpFactor = (factor - currentColor.position) / range; \
    finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
} \


void main() {
    vec3 mainColor = vec3(0, 1, 0);

    float rand = fbm(vPosition+vec3(uTime));

    float cum = 0.;
    int i = 0;
    while (cum < rand && i < COLOR_NUM) {
        cum += uColors[i];
        i++;
    }
    cum;

    ColorStop[COLOR_NUM] colors = ColorStop[](
        ColorStop(vec3(1., 0., 0.), 0.08),
        ColorStop(vec3(0.5, 0., 0.5), 0.16),
        ColorStop(vec3(1., 1., 0.), 0.25),
        ColorStop(vec3(0.98, 0.82, 0.5), 0.33),
        ColorStop(vec3(0.52, 0.8, 0.92), 0.41),
        ColorStop(vec3(0.52, 0., 0.), 0.5),
        ColorStop(vec3(0., 0.58, 1.), 0.58),
        ColorStop(vec3(1., 0.64, 0.), 0.66),
        ColorStop(vec3(1., 0.76, 1.), 0.75),
        ColorStop(vec3(0., 1., 0.), 0.83),
        ColorStop(vec3(0.95, 0.22, 0.41), 0.91),
        ColorStop(vec3(0., 0., 1.), 1.)
    );

    vec3 color;
    COLOR_RAMP(colors, cum, color);


    gl_FragColor = vec4(color, 1);
}