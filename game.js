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

// Stored power-ups
let storedPowerUps = []; // Array to store power-ups
const maxStoredPowerUps = 3; // Maximum number of stored power-ups
let isLaunchingPowerUp = false; // Flag to track if a power-up is being launched

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

// Global variables for paddles
let paddleGroup = new THREE.Group();
let paddles = [];

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
function createPaddles(withAnimation = false) {
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
    
    // Calculate exact target position - used for both animated and non-animated
    const targetX = Math.cos(angle) * paddleOrbitRadius * gameScale;
    const targetY = Math.sin(angle) * paddleOrbitRadius * gameScale;
    
    if (withAnimation) {
      // Start position further away from center for animation
      const startDistance = spawnRadius * 1.2;
      paddle.position.x = Math.cos(angle) * startDistance;
      paddle.position.y = Math.sin(angle) * startDistance;
      
      // Store target position for animation - using the exact calculated values
      paddle.userData.targetX = targetX;
      paddle.userData.targetY = targetY;
      
      // Initial velocity pointing toward target (very small for slower start)
      const dirX = targetX - paddle.position.x;
      const dirY = targetY - paddle.position.y;
      const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
      
      paddle.userData.velocity = new THREE.Vector2(
        dirX / dirLength * 0.02, // Very gentle initial velocity
        dirY / dirLength * 0.02
      );
      
      paddle.userData.animating = true;
      paddle.userData.animationTime = 0;
    } else {
      // Regular positioning without animation - using the exact calculated values
      paddle.position.x = targetX;
      paddle.position.y = targetY;
    }
    
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
        // Update paddle animations if needed
        try {
          updatePaddleAnimations();
        } catch (error) {
          console.error("Error updating paddle animations:", error);
        }
        
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
  document.getElementById('storedPowerUps').style.display = "none"; // Hide stored power-ups
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
  
  // Reset stored power-ups
  resetStoredPowerUps();
  document.getElementById('storedPowerUps').style.display = "flex";

  cubes.forEach((cube) => scene.remove(cube));
  cubes.length = 0;

  if (!sphere) {
    sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.add(wireframe);
    scene.add(sphere);
    sphere.userData.rotationSpeed = new THREE.Vector3(0.01, 0.015, 0.005);
  }

  sphere.position.set(0, 0, 0);

  // Create paddles with animation
  createPaddles(true);

  // Wait longer before spawning cubes to allow for slower paddle animation
  setTimeout(() => {
    startSpawningCubes();
  }, 3000); // Increased from 1200ms to 3000ms for the slower animation
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
        vec3 color;
        color.r = sin(t * 6.28318) * 0.5 + 0.5;
        color.g = sin(t * 6.28318 + 2.0944) * 0.5 + 0.5;
        color.b = sin(t * 6.28318 + 4.1888) * 0.5 + 0.5;
        return color;
      }
      
      void main() {
        vec2 centered = vUv - 0.5;
        float dist = length(centered);
        vec3 color = rainbow(dist * 3.0 - time * 2.0);
        
        // Add glow at the edges
        float edgeGlow = smoothstep(0.35, 0.5, dist);
        color = mix(color, vec3(1.0), edgeGlow * 0.7);
        
        // Adjust opacity based on distance for a soft edge
        float alpha = smoothstep(0.5, 0.35, dist);
        
        gl_FragColor = vec4(color, alpha * 0.7);
      }
    `,
    transparent: true,
  });
  
  // Create the power-up sphere mesh
  powerUpSphere = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
  
  // Position the power-up at a random angle at the spawn radius
  const angle = Math.random() * Math.PI * 2;
  powerUpSphere.position.x = Math.cos(angle) * spawnRadius;
  powerUpSphere.position.y = Math.sin(angle) * spawnRadius;
  
  // Set the power-up velocity toward the center, faster than regular cubes
  powerUpSphere.userData.velocity = new THREE.Vector3(
    -powerUpSphere.position.x,
    -powerUpSphere.position.y,
    0
  )
    .normalize()
    .multiplyScalar(cubeSpeed * 1.8); // Much faster than regular cubes
  
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
  
  // Create rainbow shader material
  const effectMaterial = new THREE.ShaderMaterial({
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
        vec3 color;
        color.r = sin(t * 6.28318) * 0.5 + 0.5;
        color.g = sin(t * 6.28318 + 2.0944) * 0.5 + 0.5;
        color.b = sin(t * 6.28318 + 4.1888) * 0.5 + 0.5;
        return color;
      }
      
      void main() {
        vec2 centered = vUv - 0.5;
        float dist = length(centered);
        vec3 color = rainbow(dist * 5.0 - time * 3.0);
        
        // Add glow at the edges
        float edgeGlow = smoothstep(0.35, 0.5, dist);
        color = mix(color, vec3(1.0), edgeGlow * 0.5);
        
        // Adjust opacity based on distance for a soft edge
        float alpha = smoothstep(0.5, 0.35, dist);
        
        gl_FragColor = vec4(color, alpha * 0.8);
      }
    `,
    transparent: true,
  });
  
  const effect = new THREE.Mesh(effectGeometry, effectMaterial);
  effect.position.copy(position);
  scene.add(effect);
  
  // Animate the effect
  let scale = 0.1;
  let time = 0;
  const expandEffect = setInterval(() => {
    scale += 0.2;
    time += 0.1;
    effect.scale.set(scale, scale, scale);
    effectMaterial.uniforms.time.value = time;
    
    if (scale >= 2) {
      clearInterval(expandEffect);
      scene.remove(effect);
    }
  }, 30);
}

// Activate the power-up effect
function activatePowerUp() {
  // Check if all paddles exist
  if (paddles.length >= 6) {
    // Store the power-up instead of using it immediately
    storePowerUp();
    return;
  }

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

// Store a power-up for later use
function storePowerUp() {
  if (storedPowerUps.length >= maxStoredPowerUps) {
    // If storage is full, just activate the power-up
    if (paddleGroup) {
      scene.remove(paddleGroup);
    }
    createPaddles();
    createPowerUpEffect();
    
    if (powerUpSphere) {
      scene.remove(powerUpSphere);
      powerUpSphere = null;
    }
    return;
  }
  
  // Add to stored power-ups
  storedPowerUps.push({
    id: Date.now() // Simple unique ID
  });
  
  // Update the display
  updateStoredPowerUpsDisplay();
  
  // Create a collection effect
  createCollectionEffect();
  
  // Remove the power-up sphere
  if (powerUpSphere) {
    scene.remove(powerUpSphere);
    powerUpSphere = null;
  }
}

// Create a collection effect when storing a power-up
function createCollectionEffect() {
  if (!powerUpSphere) return;
  
  // Create a trail from current position to bottom of screen
  const startPos = powerUpSphere.position.clone();
  const endPos = new THREE.Vector3(0, -3 * gameScale, 0);
  
  // Create particles along the path
  const numParticles = 15;
  const particles = [];
  
  for (let i = 0; i < numParticles; i++) {
    const particle = document.createElement('div');
    particle.className = 'collection-particle';
    particle.style.position = 'absolute';
    particle.style.width = '10px';
    particle.style.height = '10px';
    particle.style.borderRadius = '50%';
    particle.style.backgroundColor = 'white';
    particle.style.boxShadow = '0 0 10px white';
    particle.style.zIndex = '90';
    
    // Set initial position by projecting 3D position to screen
    const t = i / numParticles;
    const pos = startPos.clone().lerp(endPos, t);
    const vector = pos.clone().project(camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
    
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    
    // Add to document
    document.body.appendChild(particle);
    particles.push(particle);
    
    // Animate with delay based on position
    setTimeout(() => {
      particle.style.transition = 'opacity 0.5s ease';
      particle.style.opacity = '0';
      
      // Remove after animation
      setTimeout(() => {
        if (document.body.contains(particle)) {
          document.body.removeChild(particle);
        }
      }, 500);
    }, t * 500);
  }
}

// Update the display of stored power-ups
function updateStoredPowerUpsDisplay() {
  const container = document.getElementById('storedPowerUps');
  if (!container) return;
  
  // Clear the container
  container.innerHTML = '';
  
  // Add each stored power-up
  storedPowerUps.forEach((powerUp, index) => {
    const powerUpElement = document.createElement('div');
    powerUpElement.className = 'stored-power-up';
    powerUpElement.dataset.id = powerUp.id;
    powerUpElement.title = 'Click to launch power-up';
    
    // Create the inner content (can be an icon or text)
    powerUpElement.innerHTML = '<span style="color: white; font-weight: bold;">+</span>';
    
    // Add click event to launch this power-up
    powerUpElement.addEventListener('click', () => {
      if (currentState === GameState.PLAYING && !isGameOver && !isLaunchingPowerUp) {
        launchStoredPowerUp(index);
      }
    });
    
    container.appendChild(powerUpElement);
  });
}

// Launch a stored power-up
function launchStoredPowerUp(index) {
  if (index >= storedPowerUps.length || isLaunchingPowerUp) return;
  
  // Remove from stored array
  const powerUp = storedPowerUps.splice(index, 1)[0];
  
  // Update display
  updateStoredPowerUpsDisplay();
  
  // Set launching flag
  isLaunchingPowerUp = true;
  
  // Create a power-up sphere from the edge of the screen
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
        vec3 color;
        color.r = sin(t * 6.28318) * 0.5 + 0.5;
        color.g = sin(t * 6.28318 + 2.0944) * 0.5 + 0.5;
        color.b = sin(t * 6.28318 + 4.1888) * 0.5 + 0.5;
        return color;
      }
      
      void main() {
        vec2 centered = vUv - 0.5;
        float dist = length(centered);
        vec3 color = rainbow(dist * 3.0 - time * 2.0);
        
        // Add glow at the edges
        float edgeGlow = smoothstep(0.35, 0.5, dist);
        color = mix(color, vec3(1.0), edgeGlow * 0.7);
        
        // Adjust opacity based on distance for a soft edge
        float alpha = smoothstep(0.5, 0.35, dist);
        
        gl_FragColor = vec4(color, alpha * 0.7);
      }
    `,
    transparent: true,
  });
  
  // Create the power-up sphere mesh
  powerUpSphere = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
  
  // Position the power-up at a random angle at the spawn radius (edge of screen)
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
    .multiplyScalar(cubeSpeed * 2.0); // Even faster than regular power-ups
  
  // Set rotation speed
  powerUpSphere.userData.rotationSpeed = new THREE.Vector3(
    Math.random() * 0.03 - 0.015,
    Math.random() * 0.03 - 0.015,
    Math.random() * 0.03 - 0.015
  );
  
  // Add the power-up to the scene
  scene.add(powerUpSphere);
  
  // Create a visual effect when launching
  createLaunchEffect(powerUpSphere.position.clone());
  
  // Reset launching flag after a short delay
  setTimeout(() => {
    isLaunchingPowerUp = false;
  }, 1000);
}

// Create a visual effect when launching a stored power-up
function createLaunchEffect(position) {
  // Create a burst effect
  const effectGeometry = new THREE.SphereGeometry(0.2 * gameScale, 8, 8);
  
  // Create rainbow shader material
  const effectMaterial = new THREE.ShaderMaterial({
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
        vec3 color;
        color.r = sin(t * 6.28318) * 0.5 + 0.5;
        color.g = sin(t * 6.28318 + 2.0944) * 0.5 + 0.5;
        color.b = sin(t * 6.28318 + 4.1888) * 0.5 + 0.5;
        return color;
      }
      
      void main() {
        vec2 centered = vUv - 0.5;
        float dist = length(centered);
        vec3 color = rainbow(dist * 5.0 + time * 3.0);
        
        // Add glow at the edges
        float edgeGlow = smoothstep(0.35, 0.5, dist);
        color = mix(color, vec3(1.0), edgeGlow * 0.5);
        
        // Adjust opacity based on distance for a soft edge
        float alpha = smoothstep(0.5, 0.35, dist);
        
        gl_FragColor = vec4(color, alpha * 0.8);
      }
    `,
    transparent: true,
  });
  
  const effect = new THREE.Mesh(effectGeometry, effectMaterial);
  effect.position.copy(position);
  scene.add(effect);
  
  // Animate the effect
  let scale = 0.1;
  let time = 0;
  const expandEffect = setInterval(() => {
    scale += 0.3;
    time += 0.15;
    effect.scale.set(scale, scale, scale);
    effectMaterial.uniforms.time.value = time;
    
    if (scale >= 3) {
      clearInterval(expandEffect);
      scene.remove(effect);
    }
  }, 30);
}

// Reset the stored power-ups when starting a new game
function resetStoredPowerUps() {
  storedPowerUps = [];
  updateStoredPowerUpsDisplay();
}

// Create visual effect for power-up activation
function createPowerUpEffect() {
  // Create a pulsing light effect at the center
  const effectGeometry = new THREE.SphereGeometry(1.5 * gameScale, 32, 32);
  
  // Create shader material for rainbow effect
  const effectMaterial = new THREE.ShaderMaterial({
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
        vec3 color;
        color.r = sin(t * 6.28318) * 0.5 + 0.5;
        color.g = sin(t * 6.28318 + 2.0944) * 0.5 + 0.5;
        color.b = sin(t * 6.28318 + 4.1888) * 0.5 + 0.5;
        return color;
      }
      
      void main() {
        vec2 centered = vUv - 0.5;
        float dist = length(centered);
        vec3 color = rainbow(dist * 3.0 - time * 2.0);
        
        // Add glow at the edges
        float edgeGlow = smoothstep(0.35, 0.5, dist);
        color = mix(color, vec3(1.0), edgeGlow * 0.7);
        
        // Adjust opacity based on distance for a soft edge
        float alpha = smoothstep(0.5, 0.35, dist);
        
        gl_FragColor = vec4(color, alpha * 0.7);
      }
    `,
    transparent: true,
  });
  
  const effect = new THREE.Mesh(effectGeometry, effectMaterial);
  scene.add(effect);
  
  // Animate the effect
  let scale = 0.1;
  let time = 0;
  const expandEffect = setInterval(() => {
    scale += 0.1;
    time += 0.05;
    effect.scale.set(scale, scale, scale);
    effectMaterial.uniforms.time.value = time;
    
    if (scale >= 3) {
      clearInterval(expandEffect);
      scene.remove(effect);
    }
  }, 50);
}

// Update paddle animations
function updatePaddleAnimations() {
  if (!paddles || paddles.length === 0) return false;
  
  let allSettled = true;
  
  paddles.forEach(paddle => {
    if (!paddle || !paddle.userData || !paddle.userData.animating) return;
    
    // Spring physics parameters - adjusted for slower, more controlled motion
    const springStrength = 0.02; // Gentle approach
    const damping = 0.95; // High stability
    
    // Calculate spring force
    const dx = paddle.userData.targetX - paddle.position.x;
    const dy = paddle.userData.targetY - paddle.position.y;
    
    // Apply spring force to velocity
    if (!paddle.userData.velocity) {
      paddle.userData.velocity = new THREE.Vector2(0, 0);
    }
    
    paddle.userData.velocity.x += dx * springStrength;
    paddle.userData.velocity.y += dy * springStrength;
    
    // Apply damping
    paddle.userData.velocity.x *= damping;
    paddle.userData.velocity.y *= damping;
    
    // Update position
    paddle.position.x += paddle.userData.velocity.x;
    paddle.position.y += paddle.userData.velocity.y;
    
    // Prevent sphere overlap by ensuring minimum distance from center
    const distanceFromCenter = Math.sqrt(
      paddle.position.x * paddle.position.x + 
      paddle.position.y * paddle.position.y
    );
    
    const minDistanceFromCenter = paddleOrbitRadius * 0.7 * gameScale;
    
    if (distanceFromCenter < minDistanceFromCenter) {
      // Normalize and scale the position vector to maintain minimum distance
      const scale = minDistanceFromCenter / distanceFromCenter;
      paddle.position.x *= scale;
      paddle.position.y *= scale;
      
      // Reduce velocity to prevent bouncing back too much
      paddle.userData.velocity.x *= 0.5;
      paddle.userData.velocity.y *= 0.5;
    }
    
    // Check if settled - using more strict criteria
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
    const speedSquared = paddle.userData.velocity.x * paddle.userData.velocity.x + 
                         paddle.userData.velocity.y * paddle.userData.velocity.y;
    
    if (distanceToTarget < 0.005 * gameScale && speedSquared < 0.00005) {
      paddle.userData.animating = false;
      // Ensure exact final position
      paddle.position.x = paddle.userData.targetX;
      paddle.position.y = paddle.userData.targetY;
    } else {
      allSettled = false;
    }
    
    // Force settle after a maximum time
    if (paddle.userData.animationTime === undefined) {
      paddle.userData.animationTime = 0;
    } else {
      paddle.userData.animationTime += 0.016;
      if (paddle.userData.animationTime > 6.0) {
        paddle.userData.animating = false;
        paddle.position.x = paddle.userData.targetX;
        paddle.position.y = paddle.userData.targetY;
      }
    }
  });
  
  return allSettled;
}