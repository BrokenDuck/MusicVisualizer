#define SPIKE_NUM 32 // Set to FFT_SIZE/64
#define COLOR_NUM 12 // Constant

uniform float uTime;
uniform float uSpikeSize[SPIKE_NUM];
uniform float uColors[COLOR_NUM];
uniform float spikeAmp;
uniform float spikeWidth;
uniform float spikeHeight;

out float vDisplacement;
out vec2 vUv;
out vec3 vPosition;

float gaussian(vec2 pos, vec2 center, float A, float v, float w) {
    return A * exp(- pow(pos.x-center.x, 2.)/(2.*v*v) - pow(pos.y-center.y, 2.)/(2.*w*w));
}

float computeSpikes(vec2 pos, float freq[SPIKE_NUM], float spikeAmp, float spikeWidth, float spikeHeight) {
    float val = 0.;
    for (int i = 0; i < SPIKE_NUM; i++) {
        val += gaussian(pos, vec2((float(i))/(float(SPIKE_NUM)), 0.5), spikeAmp*freq[i], spikeWidth, spikeHeight);
    }
    val += gaussian(pos, vec2(1, 0.5), spikeAmp*freq[0], spikeWidth, spikeHeight);
    return val;
}

void main () {
    float displacement = computeSpikes(uv, uSpikeSize, spikeAmp, spikeHeight, spikeWidth);
    vec3 newPosition = position + displacement*normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1);

    vUv = uv;
    vDisplacement = displacement;
    vPosition = newPosition;
}