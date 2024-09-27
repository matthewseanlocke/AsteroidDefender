// Game states
const GameState = {
    ENTRANCE: "entrance",
    PLAYING: "playing",
    GAME_OVER: "gameOver",
  };
  
  let currentState = GameState.ENTRANCE;
  let isGameOver = false;
  
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
        // 0 = empty, 1 = block
        // Each sub-array represents a row
        // The grid represents letters A, S, T, E, R, O, I, D
        [0,1,1,0,0, 1,1,1,1,0, 1,1,1,1,1,0, 1,1,1,1,0, 1,1,1,1,0, 0,1,1,0,0, 0,1,0, 1,1,1,1],
        [1,0,0,1,0, 1,0,0,0,0, 0,0,1,0,0,0, 1,0,0,0,0, 1,0,0,1,0, 1,0,0,1,0, 0,1,0, 1,0,0,1],
        [1,1,1,1,0, 1,1,1,1,0, 0,0,1,0,0,0, 1,1,1,0,0, 1,1,1,0,0, 1,0,0,1,0, 0,1,0, 1,0,0,1],
        [1,0,0,1,0, 0,0,0,1,0, 0,0,1,0,0,0, 1,0,0,0,0, 1,0,1,0,0, 1,0,0,1,0, 0,1,0, 1,0,0,1],
        [1,0,0,1,0, 1,1,1,1,0, 0,0,1,0,0,0, 1,1,1,1,0, 1,0,0,1,0, 0,1,1,0,0, 0,1,0, 1,1,1,1]
    ];

    const logo = document.getElementById('logo');
    logo.innerHTML = ''; // Clear existing content

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
    
    // Set the grid layout based on the logo data
    logo.style.gridTemplateColumns = `repeat(${asteroidLogoData[0].length}, 1fr)`;
    logo.style.gridTemplateRows = `repeat(${asteroidLogoData.length}, 1fr)`;
}

// Call this function when the page loads
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
    // Remove existing paddle group if it exists
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
  
      // Create edges for the paddle
      const edgesGeometry = new THREE.EdgesGeometry(paddleGeometry);
      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 2,
      });
      const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  
      // Add edges as a child of the paddle
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
  
    // Create edges for the cube
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
  
    // Add random rotation
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
  
        // Trigger paddle explosion immediately
        explodePaddles();
  
        setTimeout(() => {
          currentState = GameState.GAME_OVER;
          overlay.style.display = "flex";
          gameOverText.style.display = "block";
          startText.style.display = "block";
          flashInsertCoin();
          animateLogo();
        }, 5000);
      }
  
      for (let j = i - 1; j >= 0; j--) {
        const otherCube = cubes[j];
        const distance = cube.position.distanceTo(otherCube.position);
        const combinedSize =
          (cube.geometry.parameters.width + otherCube.geometry.parameters.width) /
          2;
  
        if (distance < combinedSize) {
          const collisionNormal = cube.position
            .clone()
            .sub(otherCube.position)
            .normalize();
  
          const relativeVelocity = cube.userData.velocity
            .clone()
            .sub(otherCube.userData.velocity);
  
          const impulse = (-2 * relativeVelocity.dot(collisionNormal)) / 2;
  
          cube.userData.velocity.add(
            collisionNormal.clone().multiplyScalar(impulse)
          );
          otherCube.userData.velocity.sub(
            collisionNormal.clone().multiplyScalar(impulse)
          );
  
          const overlap = combinedSize - distance;
          const separationVector = collisionNormal
            .clone()
            .multiplyScalar(overlap / 2);
          cube.position.add(separationVector);
          otherCube.position.sub(separationVector);
  
          cube.userData.velocity.multiplyScalar(1.05);
          otherCube.userData.velocity.multiplyScalar(1.05);
        }
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
  
  function gameLoop() {
    requestAnimationFrame(gameLoop);
  
    // Update cube positions and rotations regardless of game state
    cubes.forEach((cube) => {
      cube.position.add(cube.userData.velocity);
      cube.rotation.x += cube.userData.rotationSpeed.x;
      cube.rotation.y += cube.userData.rotationSpeed.y;
      cube.rotation.z += cube.userData.rotationSpeed.z;
    });
  
    // Check for cube-to-cube collisions regardless of game state
    checkCubeCollisions();
  
    if (currentState === GameState.PLAYING && !isGameOver) {
      paddleGroup.rotation.z += rotationSpeed;
  
      if (sphere) {
        sphere.rotation.x += sphere.userData.rotationSpeed.x;
        sphere.rotation.y += sphere.userData.rotationSpeed.y;
        sphere.rotation.z += sphere.userData.rotationSpeed.z;
      }
  
      checkCollisions();
    }
  
    // Update exploding paddles when game is over, regardless of current state
    if (isGameOver) {
      paddles.forEach((paddle) => {
        paddle.position.add(paddle.userData.velocity);
        paddle.rotation.x += paddle.userData.rotationSpeed.x;
        paddle.rotation.y += paddle.userData.rotationSpeed.y;
        paddle.rotation.z += paddle.userData.rotationSpeed.z;
      });
    }
  
    clearDistantCubes();
    renderer.render(scene, camera);
  }
  
  gameLoop();
  
window.addEventListener("resize", onWindowResize, false);

// New function to handle cube-to-cube collisions
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

function startGame() {
  currentState = GameState.PLAYING;
  isGameOver = false;
  overlay.style.display = "none";
  gameOverText.style.display = "none";

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

  function init() {
    currentState = GameState.ENTRANCE;
    overlay.style.display = "flex";
    gameOverText.style.display = "none";
    startText.style.opacity = "1";  // Add this line
    animateLogo();
    flashInsertCoin();
  }

startText.addEventListener("click", startGame);
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && currentState !== GameState.PLAYING) {
    startGame();
  }
});

init();