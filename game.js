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
let nextPowerUpThreshold = 10; // First power-up at 10 points
const powerUpInterval = 10; // New power-up every 10 points

// Change from single powerUpSphere to an array of power-up spheres
let powerUpSpheres = [];

// Stored power-ups
let storedPowerUps = []; // Array to store power-ups
const maxStoredPowerUps = 3; // Maximum number of stored power-ups
let isLaunchingPowerUp = false; // Flag to track if a power-up is being launched

// Global variable to track the blinking interval
let insertCoinBlinkInterval = null;

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

// Camera zoom settings
let defaultZoom = 10 * gameScale;
let portraitZoom = 14 * gameScale; // Increased from 3.5 to pull back camera
let landscapeZoom = 7.0 * gameScale; // Increased from 1.5 to pull back camera
let zoomStep = 0.5 * gameScale;
let minZoom = 3 * gameScale;
let maxZoom = 20 * gameScale;

// Set initial camera position based on orientation
if (window.innerWidth > window.innerHeight) {
  camera.position.z = landscapeZoom;
} else {
  camera.position.z = portraitZoom;
}

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
  // Remove the condition that prevents spawning when game is over
  if (cubes.length >= 20 || currentState !== GameState.PLAYING && !isGameOver) return;

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

function clearAllCubes() {
  // Remove all cubes from the scene and array
  for (let i = cubes.length - 1; i >= 0; i--) {
    if (cubes[i]) {
      scene.remove(cubes[i]);
    }
  }
  cubes.length = 0;
}

let cubeSpawnInterval;
const spawnInterval = 3000;

function startSpawningCubes() {
  // Clear any existing interval to prevent duplicates
  if (cubeSpawnInterval) {
    clearInterval(cubeSpawnInterval);
    cubeSpawnInterval = null;
  }
  
  // Make sure we're in playing state
  if (currentState !== GameState.PLAYING || isGameOver) {
    return;
  }
  
  // Create the first cube immediately
  createCube();
  
  // Set up the interval for subsequent cubes
  cubeSpawnInterval = setInterval(createCube, spawnInterval);
}

function stopSpawningCubes() {
  if (cubeSpawnInterval) {
    clearInterval(cubeSpawnInterval);
    cubeSpawnInterval = null;
  }
}

// Transition to game over state
function transitionToGameOver() {
  // Update high score if current score is higher
  if (currentScore > highScore) {
    highScore = currentScore;
  }

  explodePaddles();
  
  // Instead of stopping cube spawning, increase the spawn rate for game over
  if (cubeSpawnInterval) {
    clearInterval(cubeSpawnInterval);
  }
  // Spawn cubes more frequently during game over
  cubeSpawnInterval = setInterval(createCube, spawnInterval / 2);
  
  setTimeout(() => {
    currentState = GameState.GAME_OVER;
    overlay.style.display = "flex";
    gameOverText.style.display = "block";
    startText.style.display = "block";
    // Show and update high score on game over
    document.getElementById("highScore").style.display = "block";
    displayHighScore();
    // Make sure we use a fresh blinking interval
    flashInsertCoin();
    animateLogo();
    // Hide score and stored power-ups on game over
    document.getElementById("scoreDisplay").style.display = "none";
    document.getElementById('storedPowerUps').style.display = "none";
  }, 5000);
}

function checkCollisions() {
  // Skip collision detection if game is not in playing state
  if (currentState !== GameState.PLAYING || isGameOver) return;
  
  const sphereRadius = 0.25 * gameScale;

  for (let i = cubes.length - 1; i >= 0; i--) {
    const cube = cubes[i];
    if (!cube) continue;
    
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
      
      playSphereDestructionEffect(sphere.position.clone());
      scene.remove(sphere);
      if (sphere.children.includes(wireframe)) {
        sphere.remove(wireframe);
      }

      sphere = null;
      isGameOver = true;
      
      // Call the new transition function instead of handling game over here
      transitionToGameOver();
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
        // Get direction from center of paddle to center of sphere (where the player is)
        const centerDirection = sphere ? 
          new THREE.Vector3().subVectors(sphere.position, paddleWorldPosition).normalize() :
          new THREE.Vector3(0, 0, 0);
        
        // Get hit position on paddle (relative to paddle center)
        const hitOffset = new THREE.Vector3().subVectors(cube.position, paddleWorldPosition);
        
        // Project hit offset onto paddle's "surface" plane
        const paddleNormal = centerDirection.clone();
        const paddleTangent = new THREE.Vector3(-paddleNormal.y, paddleNormal.x, 0).normalize();
        
        // Calculate how far from center the hit occurred (-1 to 1, where 0 is center)
        const hitFactor = paddleTangent.dot(hitOffset.normalize()) * 1.5; // Amplify the effect
        
        // Create reflection direction based on hit position
        // Center hits go straight back, edge hits go at an angle
        const reflectionDir = new THREE.Vector3()
          .addScaledVector(centerDirection, -0.8) // Mostly toward center
          .addScaledVector(paddleTangent, hitFactor) // Add angle based on hit position
          .normalize();
        
        // Set the cube's velocity based on this reflection
        const speed = cube.userData.velocity.length();
        cube.userData.velocity.copy(reflectionDir).multiplyScalar(speed * 1.05);
        
        // Add a small push to prevent sticking
        const pushDistance = 0.05 * gameScale;
        cube.position.add(reflectionDir.clone().multiplyScalar(pushDistance));
        
        // Only add points if the paddle color matches the cube color
        if (cube.userData.colorIndex === paddle.userData.colorIndex) {
          // Update score
          currentScore += 1;
          
          // Check if we reached a power-up threshold
          if (currentScore >= nextPowerUpThreshold && powerUpSpheres.length === 0) {
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
      if (
        cube &&
        cube.position &&
        cube.userData &&
        cube.userData.velocity &&
        typeof cube.userData.velocity.x === 'number' &&
        typeof cube.userData.velocity.y === 'number' &&
        typeof cube.userData.velocity.z === 'number' &&
        cube.userData.rotationSpeed &&
        typeof cube.userData.rotationSpeed.x === 'number' &&
        typeof cube.userData.rotationSpeed.y === 'number' &&
        typeof cube.userData.rotationSpeed.z === 'number'
      ) {
        cube.position.add(cube.userData.velocity);
        cube.rotation.x += cube.userData.rotationSpeed.x;
        cube.rotation.y += cube.userData.rotationSpeed.y;
        cube.rotation.z += cube.userData.rotationSpeed.z;
      }
    });

    // Check for cube-to-cube collisions regardless of game state
    checkCubeCollisions();

    // Update power-up sphere if it exists, regardless of game state
    if (powerUpSpheres.length > 0) {
      try {
        // Continue moving the power-up sphere even when game is over
        for (let i = powerUpSpheres.length - 1; i >= 0; i--) {
          const powerUp = powerUpSpheres[i];
          if (!powerUp) {
            // Remove null elements from the array
            powerUpSpheres.splice(i, 1);
            continue;
          }
          
          powerUp.position.add(powerUp.userData.velocity);
          powerUp.rotation.x += powerUp.userData.rotationSpeed.x;
          powerUp.rotation.y += powerUp.userData.rotationSpeed.y;
          powerUp.rotation.z += powerUp.userData.rotationSpeed.z;
          
          // Update shader time uniform
          if (powerUp.material && powerUp.material.uniforms) {
            powerUp.material.uniforms.time.value += 0.01;
          }
          
          // Only check for collisions with paddles/sphere when game is active
          if (currentState === GameState.PLAYING && !isGameOver) {
            checkPowerUpPaddleCollisions(powerUp);
            
            // Check for collision with the center sphere
            if (sphere && powerUp && sphere.position && powerUp.position) {
              if (powerUp.position.distanceTo(sphere.position) < (0.25 + 0.35) * gameScale) {
                // Handle power-up collision
                activatePowerUp(powerUp);
                // Remove from array after activation
                powerUpSpheres.splice(i, 1);
                continue;
              }
            }
          }
          
          // Remove if it goes too far, regardless of game state
          if (powerUp && powerUp.position) {
            if (powerUp.position.length() > spawnRadius * 1.5) {
              scene.remove(powerUp);
              powerUpSpheres.splice(i, 1);
            }
          }
        }
      } catch (error) {
        console.error("Error updating power-up spheres:", error);
        // Clean up in case of error
        powerUpSpheres.forEach(powerUp => {
          if (powerUp) {
            scene.remove(powerUp);
          }
        });
        powerUpSpheres = [];
      }
    }

    if (currentState === GameState.PLAYING && !isGameOver) {
      if (paddleGroup) {
        // Update paddle animations if needed
        try {
          updatePaddleAnimations();
        } catch (error) {
          console.error("Error updating paddle animations:", error);
        }
        
        if (paddleGroup && typeof paddleGroup.rotation === 'object' && 
            typeof paddleGroup.rotation.z === 'number' && 
            typeof rotationSpeed === 'number') {
          paddleGroup.rotation.z += rotationSpeed;
        }
      }

      if (sphere && sphere.userData && 
          sphere.userData.rotationSpeed && 
          typeof sphere.userData.rotationSpeed.x === 'number' &&
          typeof sphere.userData.rotationSpeed.y === 'number' &&
          typeof sphere.userData.rotationSpeed.z === 'number') {
        sphere.rotation.x += sphere.userData.rotationSpeed.x;
        sphere.rotation.y += sphere.userData.rotationSpeed.y;
        sphere.rotation.z += sphere.userData.rotationSpeed.z;
      }

      checkCollisions();
      updateScoreDisplay();
    }

    // Update exploding paddles when game is over, regardless of current state
    if (isGameOver) {
      paddles.forEach((paddle) => {
        if (paddle && paddle.position && paddle.userData && 
            paddle.userData.velocity && 
            typeof paddle.userData.velocity.x === 'number' &&
            typeof paddle.userData.velocity.y === 'number' &&
            typeof paddle.userData.velocity.z === 'number' &&
            paddle.userData.rotationSpeed &&
            typeof paddle.userData.rotationSpeed.x === 'number' &&
            typeof paddle.userData.rotationSpeed.y === 'number' &&
            typeof paddle.userData.rotationSpeed.z === 'number') {
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

// Run the countdown animation
function runCountdown(callback) {
  const countdownContainer = document.getElementById('countdownContainer');
  const countdownDisplay = document.getElementById('countdownDisplay');
  
  // Show countdown container
  countdownContainer.style.display = 'flex';
  
  // Set initial number
  countdownDisplay.textContent = '3';
  countdownDisplay.classList.remove('go');
  
  // Function to update countdown
  const updateCountdown = (number) => {
    // Reset animation classes
    countdownDisplay.classList.remove('active', 'fade-out');
    
    // Force reflow to restart animation
    void countdownDisplay.offsetWidth;
    
    // Update text
    if (number === 0) {
      countdownDisplay.textContent = 'GO!';
      countdownDisplay.classList.add('go');
    } else {
      countdownDisplay.textContent = number.toString();
    }
    
    // Start animation
    countdownDisplay.classList.add('active');
    
    // Start fade out after a delay
    setTimeout(() => {
      countdownDisplay.classList.add('fade-out');
    }, 600);
  };
  
  // Run countdown sequence
  updateCountdown(3);
  
  setTimeout(() => updateCountdown(2), 1000);
  setTimeout(() => updateCountdown(1), 2000);
  setTimeout(() => {
    updateCountdown(0);
    
    // Hide countdown and call callback after GO! animation
    setTimeout(() => {
      countdownContainer.style.display = 'none';
      if (callback && typeof callback === 'function') {
        callback();
      }
    }, 1000);
  }, 3000);
}

function startGame() {
  // Stop any existing cube spawning first
  stopSpawningCubes();
  
  // Clear all existing cubes
  clearAllCubes();
  
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
  if (powerUpSpheres.length > 0) {
    powerUpSpheres.forEach(powerUp => {
      if (powerUp) {
        scene.remove(powerUp);
        powerUp = null;
      }
    });
    powerUpSpheres = [];
  }
  
  // Reset stored power-ups
  resetStoredPowerUps();
  document.getElementById('storedPowerUps').style.display = "flex";

  if (!sphere) {
    sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.add(wireframe);
    scene.add(sphere);
    sphere.userData.rotationSpeed = new THREE.Vector3(0.01, 0.015, 0.005);
  }

  sphere.position.set(0, 0, 0);

  // Create paddles with animation
  createPaddles(true);

  // Start countdown after paddles finish animating
  setTimeout(() => {
    // Start the countdown animation
    runCountdown(() => {
      // Only start spawning cubes after countdown is complete
      startSpawningCubes();
    });
  }, 1000); // Reduced wait for paddle animation
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
  // Clear any existing interval first
  if (insertCoinBlinkInterval) {
    clearInterval(insertCoinBlinkInterval);
    insertCoinBlinkInterval = null;
  }
  
  let visible = true;
  insertCoinBlinkInterval = setInterval(() => {
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
      // Only restart cube spawning if the game is actively playing
      // and the countdown has already completed
      if (document.getElementById('countdownContainer').style.display === 'none') {
        startSpawningCubes();
      }
    } else if (isGameOver) {
      // If game is over, restart the faster cube spawning
      cubeSpawnInterval = setInterval(createCube, spawnInterval / 2);
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
  // Remove the check that was limiting the number of power-ups
  // if (powerUpSpheres.length >= 3) { // Limit to 3 active power-ups
  //   return;
  // }
  
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
  const powerUp = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
  
  // Position the power-up at a random angle at the spawn radius
  const angle = Math.random() * Math.PI * 2;
  powerUp.position.x = Math.cos(angle) * spawnRadius;
  powerUp.position.y = Math.sin(angle) * spawnRadius;
  
  // Set the power-up velocity toward the center, faster than regular cubes
  powerUp.userData.velocity = new THREE.Vector3(
    -powerUp.position.x,
    -powerUp.position.y,
    0
  )
    .normalize()
    .multiplyScalar(cubeSpeed * 1.8); // Much faster than regular cubes
  
  // Set rotation speed
  powerUp.userData.rotationSpeed = new THREE.Vector3(
    Math.random() * 0.03 - 0.015,
    Math.random() * 0.03 - 0.015,
    Math.random() * 0.03 - 0.015
  );
  
  // Add the power-up to the scene
  scene.add(powerUp);
  powerUpSpheres.push(powerUp);
}

// Check for collisions between power-up sphere and paddles
function checkPowerUpPaddleCollisions(powerUp) {
  if (!paddleGroup) return;
  
  try {
    for (let i = 0; i < paddles.length; i++) {
      const paddle = paddles[i];
      if (!paddle || !paddle.position) continue;
      
      const paddleWorldPosition = new THREE.Vector3();
      paddle.getWorldPosition(paddleWorldPosition);
      
      const paddleSize = new THREE.Vector3(0.3, 1, 0.5).multiplyScalar(gameScale);
      const powerUpSize = 0.35 * gameScale;
      const collisionDistance = (paddleSize.y / 2 + powerUpSize) * 0.9;
      
      if (powerUp && powerUp.position && 
          powerUp.position.distanceTo(paddleWorldPosition) < collisionDistance) {
        // Calculate reflection direction
        const normal = paddleWorldPosition
          .clone()
          .sub(sphere ? sphere.position : new THREE.Vector3())
          .normalize();
        
        // Reflect velocity
        if (powerUp.userData && powerUp.userData.velocity) {
          powerUp.userData.velocity.reflect(normal);
          
          // Apply minimum deflection angle
          const minDeflectionAngle = Math.PI / 6;
          const deflectionAngle = Math.acos(
            powerUp.userData.velocity.dot(normal) / powerUp.userData.velocity.length()
          );
          
          if (deflectionAngle < minDeflectionAngle) {
            const rotationAxis = new THREE.Vector3()
              .crossVectors(normal, powerUp.userData.velocity)
              .normalize();
            powerUp.userData.velocity.applyAxisAngle(
              rotationAxis,
              minDeflectionAngle - deflectionAngle
            );
          }
          
          // Add some push to prevent sticking
          const pushDistance = 0.1 * gameScale;
          powerUp.position.add(normal.clone().multiplyScalar(pushDistance));
          
          // Speed up slightly
          powerUp.userData.velocity.multiplyScalar(1.05);
          
          // Create a visual effect to indicate the bounce
          createBounceEffect(powerUp.position.clone());
        }
        
        break;
      }
    }
  } catch (error) {
    console.error("Error in power-up paddle collision:", error);
    // Clean up if there's an error
    if (powerUp) {
      scene.remove(powerUp);
      powerUp = null;
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
function activatePowerUp(powerUp) {
  // Check if all paddles exist
  if (paddles.length >= 6) {
    // Store the power-up instead of using it immediately
    storePowerUp(powerUp);
    return;
  }

  // Regenerate all paddles while preserving rotation
  restorePaddles();
  
  // Create a visual effect
  createPowerUpEffect();
  
  // Remove the power-up sphere
  if (powerUp) {
    scene.remove(powerUp);
    // Remove from the array
    const index = powerUpSpheres.indexOf(powerUp);
    if (index !== -1) {
      powerUpSpheres.splice(index, 1);
    }
  }
  
  // Play a sound effect (if we had sound)
  // playPowerUpSound();
}

// Store a power-up for later use
function storePowerUp(powerUp) {
  if (storedPowerUps.length >= maxStoredPowerUps) {
    // If storage is full, just activate the power-up
    // Use the helper function to restore paddles while preserving rotation
    restorePaddles();
    createPowerUpEffect();
    
    if (powerUp) {
      scene.remove(powerUp);
      // Remove from the array
      const index = powerUpSpheres.indexOf(powerUp);
      if (index !== -1) {
        powerUpSpheres.splice(index, 1);
      }
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
  if (powerUp) {
    scene.remove(powerUp);
    // Remove from the array
    const index = powerUpSpheres.indexOf(powerUp);
    if (index !== -1) {
      powerUpSpheres.splice(index, 1);
    }
  }
}

// Create a collection effect when storing a power-up
function createCollectionEffect() {
  if (!powerUpSpheres.length) return;
  
  // Create a trail from current position to bottom of screen
  const startPos = powerUpSpheres[0].position.clone(); // Use the first active power-up's position
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
  const powerUpMesh = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
  
  // Position the power-up at a random angle at the spawn radius (edge of screen)
  const angle = Math.random() * Math.PI * 2;
  powerUpMesh.position.x = Math.cos(angle) * spawnRadius;
  powerUpMesh.position.y = Math.sin(angle) * spawnRadius;
  
  // Set the power-up velocity toward the center
  powerUpMesh.userData.velocity = new THREE.Vector3(
    -powerUpMesh.position.x,
    -powerUpMesh.position.y,
    0
  )
    .normalize()
    .multiplyScalar(cubeSpeed * 2.0); // Even faster than regular power-ups
  
  // Set rotation speed
  powerUpMesh.userData.rotationSpeed = new THREE.Vector3(
    Math.random() * 0.03 - 0.015,
    Math.random() * 0.03 - 0.015,
    Math.random() * 0.03 - 0.015
  );
  
  // Add the power-up to the scene
  scene.add(powerUpMesh);
  powerUpSpheres.push(powerUpMesh);
  
  // Create a visual effect when launching
  createLaunchEffect(powerUpMesh.position.clone());
  
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

// Helper function to restore paddles while preserving rotation
function restorePaddles() {
  // Save the current paddle group rotation
  let currentRotation = 0;
  if (paddleGroup) {
    currentRotation = paddleGroup.rotation.z;
    scene.remove(paddleGroup);
  }
  
  // Regenerate all paddles
  createPaddles();
  
  // Restore the previous rotation
  if (paddleGroup) {
    paddleGroup.rotation.z = currentRotation;
  }
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

function playSphereDestructionEffect(position) {
  // 1. Clone the sphere mesh for animation
  if (!sphere) return;
  const sphereClone = sphere.clone();
  sphereClone.position.copy(position);
  scene.add(sphereClone);

  // 2. Animate scale up and fade out
  let scale = 1;
  let opacity = 1;
  const material = sphereClone.material.clone();
  material.transparent = true;
  material.opacity = 1;
  sphereClone.material = material;

  // 3. Add a glow effect (using a second mesh with additive blending)
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffcc,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowMesh = new THREE.Mesh(sphereClone.geometry.clone(), glowMaterial);
  glowMesh.position.copy(position);
  scene.add(glowMesh);

  // 4. Particle burst
  const particles = [];
  const particleCount = 18;
  for (let i = 0; i < particleCount; i++) {
    const particleGeo = new THREE.SphereGeometry(0.05 * gameScale, 6, 6);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.position.copy(position);
    // Give each particle a random direction
    const angle = (i / particleCount) * Math.PI * 2;
    const speed = 0.08 + Math.random() * 0.08;
    particle.userData.velocity = new THREE.Vector3(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      (Math.random() - 0.5) * speed
    );
    scene.add(particle);
    particles.push(particle);
  }

  // 5. Animate everything
  let animFrame;
  let t = 0;
  function animate() {
    t += 0.04;
    // Scale and fade sphere
    scale += 0.12;
    opacity -= 0.07;
    sphereClone.scale.set(scale, scale, scale);
    material.opacity = Math.max(0, opacity);
    // Glow grows and fades
    glowMesh.scale.set(scale * 1.7, scale * 1.7, scale * 1.7);
    glowMaterial.opacity = Math.max(0, opacity * 0.7);
    // Animate particles
    particles.forEach(p => {
      p.position.add(p.userData.velocity);
      p.material.opacity -= 0.06;
      if (p.material.opacity < 0) p.material.opacity = 0;
    });
    // Remove when done
    if (opacity > 0) {
      animFrame = requestAnimationFrame(animate);
    } else {
      scene.remove(sphereClone);
      scene.remove(glowMesh);
      particles.forEach(p => scene.remove(p));
      cancelAnimationFrame(animFrame);
    }
  }
  animate();
}

// Apply orientation-specific zoom on resize/orientation change
function applyOrientationZoom() {
  if (window.innerWidth > window.innerHeight) {
    // Landscape
    camera.position.z = landscapeZoom;
  } else {
    // Portrait
    camera.position.z = portraitZoom;
  }
}

// Set initial camera position based on orientation
if (window.innerWidth > window.innerHeight) {
  camera.position.z = landscapeZoom;
} else {
  camera.position.z = portraitZoom;
}

// Modify existing onWindowResize function to include zoom adjustment
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  createPaddles();
  applyOrientationZoom();
}