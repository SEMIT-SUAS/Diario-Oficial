// WebGL Background Animation with Three.js
(function() {
    const canvas = document.getElementById('webgl-background');
    if (!canvas) return;
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Gradient background colors (blue to purple)
    scene.fog = new THREE.Fog(0x667eea, 1, 15);
    renderer.setClearColor(0x667eea, 1);
    
    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 3000;
    const posArray = new Float32Array(particlesCount * 3);
    const colorsArray = new Float32Array(particlesCount * 3);
    
    for(let i = 0; i < particlesCount * 3; i += 3) {
        // Position
        posArray[i] = (Math.random() - 0.5) * 20;
        posArray[i + 1] = (Math.random() - 0.5) * 20;
        posArray[i + 2] = (Math.random() - 0.5) * 20;
        
        // Colors (gradient from blue to purple)
        const mixFactor = Math.random();
        colorsArray[i] = 0.4 + mixFactor * 0.2;     // R
        colorsArray[i + 1] = 0.5 - mixFactor * 0.2; // G
        colorsArray[i + 2] = 0.9;                    // B
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    
    // Material
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.03,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    });
    
    // Mesh
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    camera.position.z = 5;
    
    // Mouse movement effect
    let mouseX = 0;
    let mouseY = 0;
    
    document.addEventListener('mousemove', function(event) {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Animation
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.001;
        
        // Rotate particles
        particlesMesh.rotation.y = time * 0.5;
        particlesMesh.rotation.x = time * 0.3;
        
        // Mouse interaction
        particlesMesh.rotation.y += mouseX * 0.01;
        particlesMesh.rotation.x += mouseY * 0.01;
        
        // Wave effect
        const positions = particlesGeometry.attributes.position.array;
        for(let i = 0; i < particlesCount; i++) {
            const i3 = i * 3;
            const x = positions[i3];
            const y = positions[i3 + 1];
            
            positions[i3 + 2] = Math.sin(time * 2 + x * 0.5) * 0.5 + Math.cos(time * 2 + y * 0.5) * 0.5;
        }
        particlesGeometry.attributes.position.needsUpdate = true;
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    // Handle resize
    window.addEventListener('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Hide WebGL when dashboard is shown
    const observer = new MutationObserver(function() {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen && loginScreen.classList.contains('hidden')) {
            canvas.style.display = 'none';
        } else {
            canvas.style.display = 'block';
        }
    });
    
    observer.observe(document.getElementById('app'), {
        attributes: true,
        childList: true,
        subtree: true
    });
})();
