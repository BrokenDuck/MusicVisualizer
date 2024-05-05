import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import WebGL from 'three/addons/capabilities/WebGL.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SoftGlitchPass } from './passes/SoftGlitchPass'

// To easily modify values in dev mode
import { Pane } from 'tweakpane'

// For animations
import gsap from 'gsap'

// GLSL Shader Definitions
import noisyVertexShader from './glsl/noisy-vertex-shader.vert'
import noisyFragmentShader from './glsl/noisy-fragment-shader.frag'
import spikyVertexShader from './glsl/spiky-vertex-shader.vert'
import spikyFragmentShader from './glsl/spiky-fragment-shader.frag'


// Music Track to Play
import TRACK from './sounds/alex-productions-hot-pepper.mp3'

const SIZES = {
    width: window.innerWidth,
    height: window.innerHeight
}

const PARAMS = {
    ball: 'spiky-ball',
    amp: 0.4,
    width: 0.01,
    height: 0.01,
}

const FFT_SIZE = 4096

const VOLUME = 0.5

const WIREFRAME_DELTA = 0.015

const SOFT_GLITCH_INITIAL = 0.8

const canvasWebGl = document.querySelector('canvas.webgl');

const stats = new Stats()
document.body.appendChild(stats.dom)

// Add pane to tweak variables in development
let ballBinding, ampBinding, widthBinding, heightBinding
if (import.meta.env.DEV) {
    const pane = new Pane()
    ballBinding = pane.addBinding(PARAMS, 'ball', {
        options: {
            noisy: "noisy-ball",
            spiky: "spiky-ball",
        }
    })
    ampBinding = pane.addBinding(PARAMS, 'amp', {
        min: 0,
        max: 1,
    })
    widthBinding = pane.addBinding(PARAMS, 'width', {
        min: 0,
        max: 0.1,
    })
    heightBinding = pane.addBinding(PARAMS, 'height', {
        min: 0,
        max: 0.1,
    })
}

class Visualizer {
    constructor(averageFrequencyUniformName, spikeSizeUniformName, colorUniformName, ...meshes) {
        this.meshes = meshes
        this.averageFrequencyUniformName = averageFrequencyUniformName
        this.spikeSizeUniformName = spikeSizeUniformName
        this.colorUniformName = colorUniformName

        // audio listener
        this.listener = new THREE.AudioListener()

        // global audio source
        this.sound = new THREE.Audio(this.listener)
        this.loader = new THREE.AudioLoader()

        // analyser
        this.analyser = new THREE.AudioAnalyser(this.sound, FFT_SIZE)

        // Mesh setup
        for (const mesh of this.meshes) {
            mesh.material.uniforms[this.averageFrequencyUniformName] = {value: 0}
            mesh.material.uniforms[this.spikeSizeUniformName] = {value: []}
            mesh.material.uniforms[this.colorUniformName] = {value: []}
            mesh.add(this.listener)
        }
    }

    load(path) {
        this.loader.load(path, (buffer) => {
            this.sound.setBuffer(buffer)
            this.sound.setLoop(true)
            this.sound.setVolume(VOLUME)
            this.sound.play()
        })
    }

    getFrequency() {
        return this.analyser.getAverageFrequency()
    }

    getFrequencyData() {
        return this.analyser.getFrequencyData() // returns array of length FFT_SIZE/2
    }

    updateSpike() {
        const freq = Math.max(this.getFrequency() - 100, 0) / 50
        const freqData = Array.from(this.getFrequencyData()).map((v) => {return v/255})
        const sliceSize = FFT_SIZE/64
        const spikeData = []
        for (let i = 0; i < FFT_SIZE/2; i += sliceSize) {
            let sum = 0
            for (let j = i; j < i + sliceSize; j++) {
                sum += freqData[j]
            }
            spikeData.push(sum/sliceSize)
        }
        for (const mesh of this.meshes) {
            const avgFreqUniform = mesh.material.uniforms[this.averageFrequencyUniformName]
            const spikeSizeUniform = mesh.material.uniforms[this.spikeSizeUniformName]
            avgFreqUniform.value = freq
            spikeSizeUniform.value = spikeData
            // gsap.to(avgFreqUniform, {
            //     duration: 1.5,
            //     ease: 'Slow.easeOut',
            //     value: freq,
            // })
            // gsap.to(spikeSizeUniform, {
            //     duration: 0.5,
            //     ease: 'Slow.easeOut',
            //     values: spikeData,
            // })
            // gsap.to(colorUniform, {
            //     duration: 0.5,
            //     ease: 'Slow.easeOut',
            //     value: colorData,
            // })
        }
    }

    updateColor() {
        const freqData = Array.from(this.getFrequencyData()).map((v) => {return v/255})
        const colorData = [
            freqData[24],
            freqData[25],
            (freqData[26] + freqData[27])/2,
            freqData[28],
            (freqData[29] + freqData[30])/2,
            (freqData[31] + freqData[32])/2,
            (freqData[33] + freqData[34])/2,
            (freqData[35] + freqData[36])/2,
            (freqData[37] + freqData[38])/2,
            (freqData[39] + freqData[40])/2,
            (freqData[41] + freqData[42] + freqData[43])/3,
            (freqData[44] + freqData[45])/2
        ]
        for (const mesh of this.meshes) {
            const colorUniform = mesh.material.uniforms[this.colorUniformName]
            colorUniform.value = colorData
            // gsap.to(avgFreqUniform, {
            //     duration: 1.5,
            //     ease: 'Slow.easeOut',
            //     value: freq,
            // })
            // gsap.to(spikeSizeUniform, {
            //     duration: 0.5,
            //     ease: 'Slow.easeOut',
            //     values: spikeData,
            // })
            // gsap.to(colorUniform, {
            //     duration: 0.5,
            //     ease: 'Slow.easeOut',
            //     value: colorData,
            // })
        }
    }
}

let renderer, scene, camera, control, composer, visualizer, meshes
let softGlitchPass

function init() {
    // Define scene
    scene = new THREE.Scene()

    // Define renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvasWebGl,
        antialias: true,
    })
    renderer.setSize(SIZES.width, SIZES.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Define camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000)
    camera.position.z = 5
    scene.add(camera)

    // Define control
    control = new OrbitControls(camera, canvasWebGl)
    control.enableDamping = true

    // Update on window resize
    window.addEventListener('resize', () => {
        SIZES.width = window.innerWidth
        SIZES.height = window.innerHeight

        camera.aspect = SIZES.width / SIZES.height
        camera.updateProjectionMatrix()

        renderer.setSize(SIZES.width, SIZES.height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })

    // Define meshes
    meshes = {}

    // Noisy ball
    const noisyGeometry = new THREE.SphereGeometry(1, 100, 100)
    const noisyMaterial = new THREE.ShaderMaterial({
        fragmentShader: noisyFragmentShader,
        vertexShader: noisyVertexShader,
        uniforms: {
            uTime: {value: 0},
        }
    })
    const noisyBall = new THREE.Mesh(noisyGeometry, noisyMaterial)
    noisyBall.visible = false
    noisyBall.name = "noisy-ball"
    meshes.noisyBall = noisyBall
    // We add a wireframe for visual effect
    const wireframe = new THREE.LineSegments(noisyGeometry, noisyMaterial)
    wireframe.scale.setScalar(1 + WIREFRAME_DELTA)
    noisyBall.add(wireframe)
    scene.add(noisyBall)
    const spikyGeometry = new THREE.SphereGeometry(1, 500, 500)
    const spikyMaterial = new THREE.ShaderMaterial({
        fragmentShader: spikyFragmentShader,
        vertexShader: spikyVertexShader,
        uniforms: {
            uTime: {value: 0},
            freqNum: {value: FFT_SIZE/2},
            spikeAmp: {value: 0.4},
            spikeWidth: {value: 0.01},
            spikeHeight: {value: 0.01},
        }
    })
    // Spiky ball
    const spikyBall = new THREE.Mesh(spikyGeometry, spikyMaterial)
    spikyBall.visible = true
    spikyBall.name = "spiky-ball"
    meshes.spikyBall = spikyBall
    scene.add(spikyBall)

    // Add event listener to show balls
    if (ballBinding) {
        ballBinding.on('change', (ev) => {
            for (const mesh of Object.values(meshes)) {
                mesh.visible = mesh.name == ev.value ? true : false
            }
        })
    }
    if (ampBinding) {
        ampBinding.on('change', (ev) => {
            spikyBall.material.uniforms.spikeAmp.value = ev.value
        })
    }
    if (widthBinding) {
        widthBinding.on('change', (ev) => {
            spikyBall.material.uniforms.spikeWidth.value = ev.value
        })
    }
    if (heightBinding) {
        heightBinding.on('change', (ev) => {
            spikyBall.material.uniforms.spikeHeight.value = ev.value
        })
    }
    
    // Load visualizer
    visualizer = new Visualizer('uAudioAverageFrequency', 'uSpikeSize', 'uColors', ...Object.values(meshes))
    visualizer.load(TRACK)

    // Post Processing
    composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)
    softGlitchPass = new SoftGlitchPass()
    softGlitchPass.factor = SOFT_GLITCH_INITIAL
    composer.addPass(softGlitchPass)
    const outputPass = new OutputPass()
    composer.addPass(outputPass)

}

let lastTimestamp = 0;
function animate(timestamp) {
    requestAnimationFrame(animate)

    for (const mesh of Object.values(meshes)) {
        mesh.material.uniforms.uTime.value = timestamp/1000
    }

    visualizer.updateSpike()
    visualizer.updateColor()
    
    softGlitchPass.factor = meshes.noisyBall.material.uniforms["uAudioAverageFrequency"] > 0.6 ? 0.7 : 0.1

    stats.update()
    control.update()
    composer.render()
}

if (WebGL.isWebGL2Available()) {

    // Initiate function or other initializations here
    init()
    requestAnimationFrame(animate)

} else {

    const warning = WebGL.getWebGLErrorMessage()
    document.getElementById('container').appendChild(warning)

}