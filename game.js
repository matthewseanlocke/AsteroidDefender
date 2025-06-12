// Game states
const GameState = {
  ENTRANCE: "entrance",
  PLAYING: "playing",
  GAME_OVER: "gameOver",
};

let currentState = GameState.ENTRANCE;
let isGameOver = false;
let isPaused = false;

// Scoring system
let currentScore = 0;
let highScore = 0;
let lastHitCube = null; // Track the last cube hit for collision tracking

// Power-up system
let powerUpSphere = null;
let nextPowerUpThreshold = 10; // First power-up at 10 points
const powerUpInterval = 10; // New power-up every 10 points

// SETTINGS
const gameScale = 0.25;
const cubeSpeed = 0.02 * Math.sqrt(gameScale);
const cubeRotationSpeed = 0.02;
const cubeMinSize = 0.1;
const cubeMaxSize = 3;
const spawnRadius = 18 * gameScale;
const paddleOrbitRadius = 2;

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
let renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function generateAsteroidLogo() {
  const asteroidLogoData = [
    [0,1,1,0,0, 1,1,1,1,0, 1,1,1,1,1,0, 1,1,1,1,0, 1,1,1,1,0, 0,1,1,0,0, 0,1,0, 1,1,1,1],
    [1,0,0,1,0, 1,0,0,0,0, 0,0,1,0,0,0, 1,0,0,0,0, 1,0,0,1,0, 1,0,0,1,0, 0,1,0, 1,0,0,1],
    [1,1,1,1,0, 1,1,1,1,0, 0,0,1,0,0,0, 1,1,1,0,0, 1,1,1,0,0, 1,0,0,1,0, 0,1,0, 1,0,0,1],
    [1,0,0,1,0, 0,0,0,1,0, 0,0,1,0,0,0, 1,0,0,0,0, 1,0,1,0,0, 1,0,0,1,0, 0,1,0, 1,0,0,1],
    [1,0,0,1,0, 1,1,1,1,0, 0,0,1,0,0,0, 1,1,1,1,0, 1,0,0,1,0, 0,1,1,0,0, 0,1,0, 1,1,1,1]
  ];

  const logo = document.getElementById('logo');
  logo.innerHTML = '';

  asteroidLogoData.forEach((row, rowIndex) => {
    row.forEach((cell, cellIndex) => {
      const block = document.createElement('div');
      if (cell === 1) {
        block.classList.add('logo-block');
        block.style.animationDelay = `${(rowIndex + cellIndex) * 0.02}s`;
      } else {
        block.classList.add('logo-space');
      }
      logo.appendChild(block);
    });
  });
  
  logo.style.gridTemplateColumns = `repeat(${asteroidLogoData[0].length}, 1fr)`;
  logo.style.gridTemplateRows = `repeat(${asteroidLogoData.length}, 1fr)`;
}

window.addEventListener('load', generateAsteroidLogo);

// Create a sphere
let sphereGeometry = new THREE.IcosahedronGeometry(0.25, 1);
let sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
let sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphere);

// Create wireframe for sphere outline
let wireframeGeometry = new THREE.WireframeGeometry(sphereGeometry);
let wireframeMaterial = new THREE.LineBasicMaterial({
  color: 0x000000,
  linewidth: 4,
});
let wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);

// Add wireframe as a child of the sphere
sphere.add(wireframe);

// Add rotation variables for the sphere
sphere.userData.rotationSpeed = new THREE.Vector3(0.01, 0.015, 0.005);

// Array of colors for the paddles and cubes
const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];

// Create paddles
let paddleGroup = new THREE.Group();
let paddles = [];

function createPaddles() {
  if (paddleGroup) {
    scene.remove(paddleGroup);
  }

  paddleGroup = new THREE.Group();
  paddles = [];

  const aspectRatio = window.innerWidth / window.innerHeight;
  const paddleWidth = 0.3 * gameScale * (aspectRatio < 1 ? 1.5 : 1);
  const paddleHeight = 1 * gameScale * (aspectRatio < 1 ? 0.8 : 1);

  for (let i = 0; i < 6; i++) {
    const paddleMaterial = new THREE.MeshBasicMaterial({ color: colors[i] });
    const paddleGeometry = new THREE.BoxGeometry(
      paddleWidth,
      paddleHeight,
      0.5 * gameScale
    );
    const paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);

    const edgesGeometry = new THREE.EdgesGeometry(paddleGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 2,
    });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);

    paddle.add(edges);

    const angle = (i * Math.PI) / 3;
    paddle.position.x = Math.cos(angle) * paddleOrbitRadius * gameScale;
    paddle.position.y = Math.sin(angle) * paddleOrbitRadius * gameScale;
    paddle.rotation.z = angle;
    paddle.userData.colorIndex = i;
    paddleGroup.add(paddle);
    paddles.push(paddle);
  }
  scene.add(paddleGroup);
}

createPaddles();

camera.position.z = 10 * gameScale;

// Rotation speed
let rotationSpeed = 0;

// Touch variables
let touchStartY = 0;
let isTouching = false;

// Handle key events
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    rotationSpeed = 0.05;
  } else if (event.key === "ArrowRight") {
    rotationSpeed = -0.05;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    rotationSpeed = 0;
  }
});

// Handle touch events
document.addEventListener("touchstart", handleTouchStart, { passive: false });
document.addEventListener("touchmove", handleTouchMove, { passive: false });
document.addEventListener("touchend", handleTouchEnd, { passive: false });

function handleTouchStart(event) {
  if (currentState === GameState.PLAYING) {
    event.preventDefault();
    touchStartY = event.touches[0].clientY;
    isTouching = true;
    updateRotationSpeed();
  }
}

function handleTouchMove(event) {
  if (currentState === GameState.PLAYING) {
    event.preventDefault();
    touchStartY = event.touches[0].clientY;
    updateRotationSpeed();
  }
}

function handleTouchEnd(event) {
  if (currentState === GameState.PLAYING) {
    event.preventDefault();
    isTouching = false;
    rotationSpeed = 0;
  }
}

function updateRotationSpeed() {
  if (isTouching) {
    const screenHeight = window.innerHeight;
    if (touchStartY < screenHeight / 2) {
      rotationSpeed = 0.05;
    } else {
      rotationSpeed = -0.05;
    }
  }
}

// Cubes array
const cubes = [];

// Function to create a new cube
function createCube() {
  if (cubes.length >= 20) return;

  const cubeSize =
    (Math.random() * (cubeMaxSize - cubeMinSize) + cubeMinSize) * gameScale;
  const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const colorIndex = Math.floor(Math.random() * colors.length);
  const cubeMaterial = new THREE.MeshBasicMaterial({
    color: colors[colorIndex],
  });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

  const edgesGeometry = new THREE.EdgesGeometry(cubeGeometry);
  const edgesMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 4,
  });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  cube.add(edges);

  const angle = Math.random() * Math.PI * 2;
  cube.position.x = Math.cos(angle) * spawnRadius;
  cube.position.y = Math.sin(angle) * spawnRadius;

  cube.userData.velocity = new THREE.Vector3(
    -cube.position.x,
    -cube.position.y,
    0
  )
    .normalize()
    .multiplyScalar(cubeSpeed);
  cube.userData.colorIndex = colorIndex;

  cube.userData.rotationSpeed = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  )
    .normalize()
    .multiplyScalar(cubeRotationSpeed);

  scene.add(cube);
  cubes.push(cube);
}

let cubeSpawnInterval;
const spawnInterval = 3000;

function startSpawningCubes() {
  if (cubeSpawnInterval) {
    clearInterval(cubeSpawnInterval);
  }
  cubeSpawnInterval = setInterval(createCube, spawnInterval);
}

function stopSpawningCubes() {
  if (cubeSpawnInterval) {
    clearInterval(cubeSpawnInterval);
    cubeSpawnInterval = null;
  }
}

function checkCollisions() {
  const sphereRadius = 0.25 * gameScale;

  for (let i = cubes.length - 1; i >= 0; i--) {
    const cube = cubes[i];
    const cubeSize = cube.geometry.parameters.width;
    const cubeHalfSize = cubeSize / 2;
    const collisionDistance = sphereRadius + cubeHalfSize;

    if (
      !isGameOver &&
      sphere &&
      cube.position.distanceTo(sphere.position) < collisionDistance
    ) {
      const collisionNormal = cube.position
        .clone()
        .sub(sphere.position)
        .normalize();

      cube.userData.velocity.reflect(collisionNormal);

      const pushDistance = 0.05 * gameScale;
      cube.position.add(collisionNormal.clone().multiplyScalar(pushDistance));

      cube.userData.velocity.multiplyScalar(1.05);
      
      scene.remove(sphere);
      if (sphere.children.includes(wireframe)) {
        sphere.remove(wireframe);
      }

      sphere = null;
      isGameOver = true;

      // Update high score if current score is higher
      if (currentScore > highScore) {
        highScore = currentScore;
      }

      explodePaddles();

      setTimeout(() => {
        currentState = GameState.GAME_OVER;
        overlay.style.display = "flex";
        gameOverText.style.display = "block";
        startText.style.display = "block";
        // Show and update high score on game over
        document.getElementById("highScore").style.display = "block";
        displayHighScore();
        flashInsertCoin();
        animateLogo();
      }, 5000);
    }

    for (let j = paddles.length - 1; j >= 0; j--) {
      const paddle = paddles[j];
      const paddleWorldPosition = new THREE.Vector3();
      paddle.getWorldPosition(paddleWorldPosition);

      const paddleSize = new THREE.Vector3(0.2, 1, 0.1).multiplyScalar(
        gameScale
      );
      const cubeSize = cube.geometry.parameters.width;
      const collisionDistance = (paddleSize.y / 2 + cubeSize / 2) * 0.9;

      if (cube.position.distanceTo(paddleWorldPosition) < collisionDistance) {
        const normal = paddleWorldPosition
          .clone()
          .sub(sphere ? sphere.position : new THREE.Vector3())
          .normalize();
        cube.userData.velocity.reflect(normal);

        const minDeflectionAngle = Math.PI / 6;
        const deflectionAngle = Math.acos(
          cube.userData.velocity.dot(normal) / cube.userData.velocity.length()
        );

        if (deflectionAngle < minDeflectionAngle) {
          const rotationAxis = new THREE.Vector3()
            .crossVectors(normal, cube.userData.velocity)
            .normalize();
          cube.userData.velocity.applyAxisAngle(
            rotationAxis,
            minDeflectionAngle - deflectionAngle
          );
        }

        const pushDistance = 0.05 * gameScale;
        cube.position.add(normal.multiplyScalar(pushDistance));

        cube.userData.velocity.multiplyScalar(1.05);

        // Only add points if the paddle color matches the cube color
        if (cube.userData.colorIndex === paddle.userData.colorIndex) {
          // Update score
          currentScore += 1;
          
          // Check if we reached a power-up threshold
          if (currentScore >= nextPowerUpThreshold && !powerUpSphere) {
            // Spawn a power-up
            createPowerUpSphere();
            // Set next threshold
            nextPowerUpThreshold += powerUpInterval;
          }
          
          // Create +1 score animation at the paddle hit position
          createScoreAnimation(paddleWorldPosition, 1);
          // Save the last hit cube for collision tracking
          lastHitCube = cube;
        }

        if (
          !isGameOver &&
          cube.userData.colorIndex !== paddle.userData.colorIndex
        ) {
          scene.remove(paddle);
          paddleGroup.remove(paddle);
          paddles.splice(j, 1);
        }

        break;
      }
    }
  }
}

function explodePaddles() {
  paddles.forEach((paddle) => {
    const angle = Math.atan2(paddle.position.y, paddle.position.x);
    const speed = 0.005 + Math.random() * 0.015;

    const toCameraDirection = new THREE.Vector3(0, 0, 1)
      .sub(paddle.position)
      .normalize();

    const explosionDirection = new THREE.Vector3(
      Math.cos(angle),
      Math.sin(angle),
      0
    )
      .add(toCameraDirection)
      .normalize();

    paddle.userData.velocity = explosionDirection.multiplyScalar(speed);

    paddle.userData.rotationSpeed = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).multiplyScalar(0.1);
  });
}

function clearDistantCubes() {
  const maxDistance = 20 * gameScale;
  for (let i = cubes.length - 1; i >= 0; i--) {
    if (cubes[i].position.length() > maxDistance) {
      scene.remove(cubes[i]);
      cubes.splice(i, 1);
    }
  }
}

function updateScoreDisplay() {
  const scoreElement = document.getElementById("currentScoreValue");
  if (scoreElement) {
    scoreElement.textContent = currentScore;
  }
}

function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (!isPaused) {
    // Update cube positions and rotations regardless of game state
    cubes.forEach((cube) => {
      if (cube && cube.position && cube.userData) {
        cube.position.add(cube.userData.velocity);
        cube.rotation.x += cube.userData.rotationSpeed.x;
        cube.rotation.y += cube.userData.rotationSpeed.y;
        cube.rotation.z += cube.userData.rotationSpeed.z;
      }
    });

    // Check for cube-to-cube collisions regardless of game state
    checkCubeCollisions();

    if (currentState === GameState.PLAYING && !isGameOver) {
      if (paddleGroup) {
        paddleGroup.rotation.z += rotationSpeed;
      }

      if (sphere && sphere.userData) {
        sphere.rotation.x += sphere.userData.rotationSpeed.x;
        sphere.rotation.y += sphere.userData.rotationSpeed.y;
        sphere.rotation.z += sphere.userData.rotationSpeed.z;
      }

      // Update power-up sphere if it exists
      if (powerUpSphere) {
        try {
          updatePowerUpSphere();
        } catch (error) {
          console.error("Error updating power-up sphere:", error);
          // Clean up in case of error
          if (powerUpSphere) {
            scene.remove(powerUpSphere);
            powerUpSphere = null;
          }
        }
      }

      checkCollisions();
      updateScoreDisplay();
    }

    // Update exploding paddles when game is over, regardless of current state
    if (isGameOver) {
      paddles.forEach((paddle) => {
        if (paddle && paddle.position && paddle.userData) {
          paddle.position.add(paddle.userData.velocity);
          paddle.rotation.x += paddle.userData.rotationSpeed.x;
          paddle.rotation.y += paddle.userData.rotationSpeed.y;
          paddle.rotation.z += paddle.userData.rotationSpeed.z;
        }
      });
    }

    clearDistantCubes();
  }

  renderer.render(scene, camera);
}

gameLoop();

window.addEventListener("resize", onWindowResize, false);

function checkCubeCollisions() {
  for (let i = 0; i < cubes.length; i++) {
    for (let j = i + 1; j < cubes.length; j++) {
      const cube1 = cubes[i];
      const cube2 = cubes[j];
      const distance = cube1.position.distanceTo(cube2.position);
      const combinedSize = (cube1.geometry.parameters.width + cube2.geometry.parameters.width) / 2;

      if (distance < combinedSize) {
        const collisionNormal = cube1.position.clone().sub(cube2.position).normalize();
        const relativeVelocity = cube1.userData.velocity.clone().sub(cube2.userData.velocity);
        const impulse = (-2 * relativeVelocity.dot(collisionNormal)) / 2;

        cube1.userData.velocity.add(collisionNormal.clone().multiplyScalar(impulse));
        cube2.userData.velocity.sub(collisionNormal.clone().multiplyScalar(impulse));

        const overlap = combinedSize - distance;
        const separationVector = collisionNormal.clone().multiplyScalar(overlap / 2);
        cube1.position.add(separationVector);
        cube2.position.sub(separationVector);

        cube1.userData.velocity.multiplyScalar(1.05);
        cube2.userData.velocity.multiplyScalar(1.05);
        
        // Reset lastHitCube since we're not scoring bonus points anymore
        if (lastHitCube === cube1 || lastHitCube === cube2) {
          lastHitCube = null;
        }
      }
    }
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  createPaddles();
}

const overlay = document.getElementById("overlay");
const logo = document.getElementById("logo");
const startText = document.getElementById("startText");
const gameOverText = document.getElementById("gameOverText");

function init() {
  currentState = GameState.ENTRANCE;
  overlay.style.display = "flex";
  gameOverText.style.display = "none";
  startText.style.opacity = "1";
  document.getElementById("scoreDisplay").style.display = "none";
  document.getElementById("highScore").style.display = "none"; // Hide high score on intro screen
  animateLogo();
  flashInsertCoin();
}

function startGame() {
  currentState = GameState.PLAYING;
  isGameOver = false;
  overlay.style.display = "none";
  gameOverText.style.display = "none";
  document.getElementById("highScore").style.display = "none"; // Hide high score during gameplay
  
  // Reset current score and show score display
  currentScore = 0;
  lastHitCube = null;
  document.getElementById("scoreDisplay").style.display = "block";
  updateScoreDisplay();
  
  // Reset power-up system
  nextPowerUpThreshold = 10;
  if (powerUpSphere) {
    scene.remove(powerUpSphere);
    powerUpSphere = null;
  }

  cubes.forEach((cube) => scene.remove(cube));
  cubes.length = 0;

  if (!sphere) {
    sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.add(wireframe);
    scene.add(sphere);
    sphere.userData.rotationSpeed = new THREE.Vector3(0.01, 0.015, 0.005);
  }

  sphere.position.set(0, 0, 0);

  createPaddles();

  startSpawningCubes();
}

function animateLogo() {
  const logoCubes = document.querySelectorAll(".logo-cube");
  logoCubes.forEach((cube, index) => {
    setTimeout(() => {
      cube.style.opacity = "1";
      cube.style.transform = "translateY(0)";
    }, index * 100);
  });
}

function flashInsertCoin() {
  let visible = true;
  setInterval(() => {
    startText.style.opacity = visible ? "1" : "0";
    visible = !visible;
  }, 400);
}

function handleVisibilityChange() {
  if (document.hidden) {
    isPaused = true;
    stopSpawningCubes();
  } else {
    isPaused = false;
    if (currentState === GameState.PLAYING && !isGameOver) {
      startSpawningCubes();
    }
  }
}

document.addEventListener("visibilitychange", handleVisibilityChange);

function displayHighScore() {
  const scoreElement = document.getElementById("highScoreValue");
  if (scoreElement) {
    scoreElement.textContent = highScore > 0 ? highScore : "-";
  }
}

// Function to create a floating score animation
function createScoreAnimation(position, amount) {
  // Create a div element for the score animation
  const scoreAnimation = document.createElement('div');
  scoreAnimation.className = 'score-animation';
  scoreAnimation.textContent = amount > 0 ? `+${amount}` : amount;
  
  // Set the color based on the score amount
  scoreAnimation.style.color = amount === 1 ? '#ffffff' : '#ffcc00';
  
  // Convert 3D position to screen coordinates
  const vector = position.clone();
  vector.project(camera);
  
  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
  
  // Position the score animation
  scoreAnimation.style.left = `${x}px`;
  scoreAnimation.style.top = `${y}px`;
  
  // Add the animation to the document
  document.body.appendChild(scoreAnimation);
  
  // Remove the animation after it completes
  setTimeout(() => {
    if (document.body.contains(scoreAnimation)) {
      document.body.removeChild(scoreAnimation);
    }
  }, 1500);
}

startText.addEventListener("click", startGame);
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && currentState !== GameState.PLAYING) {
    startGame();
  }
});

// Initialize the game
init();

// Create a rainbow power-up sphere
function createPowerUpSphere() {
  if (powerUpSphere) {
    scene.remove(powerUpSphere);
  }
  
  // Create geometry for the power-up sphere
  const powerUpGeometry = new THREE.IcosahedronGeometry(0.35 * gameScale, 2);
  
  // Create material with rainbow shader
  const powerUpMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 vUv;
      
      vec3 rainbow(float t) {
        // Vibrant rainbow color mapping
        vec3 color = vec3(0.0);
        float r = sin(t * 6.28318) * 0.5 + 0.5;
        float g = sin(t * 6.28318 + 2.0944) * 0.5 + 0.5;
        float b = sin(t * 6.28318 + 4.1888) * 0.5 + 0.5;
        return vec3(r, g, b);
      }
      
      void main() {
        // Create pulsing rainbow effect
        vec2 pos = vUv;
        float d = length(pos - vec2(0.5, 0.5));
        vec3 color = rainbow(d * 3.0 + time * 2.0);
        
        // Add a glow effect
        float glow = 0.5 * (1.0 + sin(time * 3.0));
        color = mix(color, vec3(1.0), glow * 0.3);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  
  // Create the power-up sphere mesh
  powerUpSphere = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
  
  // Position the power-up at a random angle at the spawn radius
  const angle = Math.random() * Math.PI * 2;
  powerUpSphere.position.x = Math.cos(angle) * spawnRadius;
  powerUpSphere.position.y = Math.sin(angle) * spawnRadius;
  
  // Set the power-up velocity toward the center
  powerUpSphere.userData.velocity = new THREE.Vector3(
    -powerUpSphere.position.x,
    -powerUpSphere.position.y,
    0
  )
    .normalize()
    .multiplyScalar(cubeSpeed * 0.8); // Slightly slower than cubes
  
  // Set rotation speed
  powerUpSphere.userData.rotationSpeed = new THREE.Vector3(
    Math.random() * 0.03 - 0.015,
    Math.random() * 0.03 - 0.015,
    Math.random() * 0.03 - 0.015
  );
  
  // Add the power-up to the scene
  scene.add(powerUpSphere);
}

// Update the power-up sphere
function updatePowerUpSphere() {
  if (!powerUpSphere) return;
  
  // Update position
  powerUpSphere.position.add(powerUpSphere.userData.velocity);
  
  // Update rotation
  powerUpSphere.rotation.x += powerUpSphere.userData.rotationSpeed.x;
  powerUpSphere.rotation.y += powerUpSphere.userData.rotationSpeed.y;
  powerUpSphere.rotation.z += powerUpSphere.userData.rotationSpeed.z;
  
  // Update shader time uniform
  if (powerUpSphere.material && powerUpSphere.material.uniforms) {
    powerUpSphere.material.uniforms.time.value += 0.01;
  }
  
  // Check for collision with paddles
  checkPowerUpPaddleCollisions();
  
  // Check for collision with the center sphere
  if (sphere && powerUpSphere && sphere.position && powerUpSphere.position) {
    if (powerUpSphere.position.distanceTo(sphere.position) < (0.25 + 0.35) * gameScale) {
      // Handle power-up collision
      activatePowerUp();
      return; // Exit early since powerUpSphere is now null
    }
  }
  
  // Remove if it goes too far
  if (powerUpSphere && powerUpSphere.position) {
    if (powerUpSphere.position.length() > spawnRadius * 1.5) {
      scene.remove(powerUpSphere);
      powerUpSphere = null;
    }
  }
}

// Check for collisions between power-up sphere and paddles
function checkPowerUpPaddleCollisions() {
  if (!powerUpSphere || !paddleGroup) return;
  
  try {
    for (let i = 0; i < paddles.length; i++) {
      const paddle = paddles[i];
      if (!paddle || !paddle.position) continue;
      
      const paddleWorldPosition = new THREE.Vector3();
      paddle.getWorldPosition(paddleWorldPosition);
      
      const paddleSize = new THREE.Vector3(0.3, 1, 0.5).multiplyScalar(gameScale);
      const powerUpSize = 0.35 * gameScale;
      const collisionDistance = (paddleSize.y / 2 + powerUpSize) * 0.9;
      
      if (powerUpSphere && powerUpSphere.position && 
          powerUpSphere.position.distanceTo(paddleWorldPosition) < collisionDistance) {
        // Calculate reflection direction
        const normal = paddleWorldPosition
          .clone()
          .sub(sphere ? sphere.position : new THREE.Vector3())
          .normalize();
        
        // Reflect velocity
        if (powerUpSphere.userData && powerUpSphere.userData.velocity) {
          powerUpSphere.userData.velocity.reflect(normal);
          
          // Apply minimum deflection angle
          const minDeflectionAngle = Math.PI / 6;
          const deflectionAngle = Math.acos(
            powerUpSphere.userData.velocity.dot(normal) / powerUpSphere.userData.velocity.length()
          );
          
          if (deflectionAngle < minDeflectionAngle) {
            const rotationAxis = new THREE.Vector3()
              .crossVectors(normal, powerUpSphere.userData.velocity)
              .normalize();
            powerUpSphere.userData.velocity.applyAxisAngle(
              rotationAxis,
              minDeflectionAngle - deflectionAngle
            );
          }
          
          // Add some push to prevent sticking
          const pushDistance = 0.1 * gameScale;
          powerUpSphere.position.add(normal.clone().multiplyScalar(pushDistance));
          
          // Speed up slightly
          powerUpSphere.userData.velocity.multiplyScalar(1.05);
          
          // Create a visual effect to indicate the bounce
          createBounceEffect(powerUpSphere.position.clone());
        }
        
        break;
      }
    }
  } catch (error) {
    console.error("Error in power-up paddle collision:", error);
    // Clean up if there's an error
    if (powerUpSphere) {
      scene.remove(powerUpSphere);
      powerUpSphere = null;
    }
  }
}

// Create a visual effect for the bounce
function createBounceEffect(position) {
  // Create a small burst effect
  const effectGeometry = new THREE.SphereGeometry(0.2 * gameScale, 8, 8);
  const effectMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7
  });
  
  const effect = new THREE.Mesh(effectGeometry, effectMaterial);
  effect.position.copy(position);
  scene.add(effect);
  
  // Animate the effect
  let scale = 0.1;
  const expandEffect = setInterval(() => {
    scale += 0.2;
    effect.scale.set(scale, scale, scale);
    effectMaterial.opacity = Math.max(0, 0.7 - scale * 0.3);
    
    if (scale >= 2) {
      clearInterval(expandEffect);
      scene.remove(effect);
    }
  }, 30);
}

// Activate the power-up effect
function activatePowerUp() {
  // Regenerate all paddles
  if (paddleGroup) {
    scene.remove(paddleGroup);
  }
  createPaddles();
  
  // Create a visual effect
  createPowerUpEffect();
  
  // Remove the power-up sphere
  if (powerUpSphere) {
    scene.remove(powerUpSphere);
    powerUpSphere = null;
  }
  
  // Play a sound effect (if we had sound)
  // playPowerUpSound();
}

// Create visual effect for power-up activation
function createPowerUpEffect() {
  // Create a pulsing light effect at the center
  const effectGeometry = new THREE.SphereGeometry(1.5 * gameScale, 32, 32);
  const effectMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7
  });
  
  const effect = new THREE.Mesh(effectGeometry, effectMaterial);
  scene.add(effect);
  
  // Animate the effect
  let scale = 0.1;
  const expandEffect = setInterval(() => {
    scale += 0.1;
    effect.scale.set(scale, scale, scale);
    effectMaterial.opacity = Math.max(0, 0.7 - scale * 0.2);
    
    if (scale >= 3) {
      clearInterval(expandEffect);
      scene.remove(effect);
    }
  }, 50);
}