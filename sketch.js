let video;
let cameraEnabled = false;
let permissionAsked = false;
let cameraBtn;
let canvas;

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  background(0);
  textAlign(CENTER, CENTER);
  textSize(24);
  fill(255);
  text('Please enable camera to start', width/2, height/2);
  createCameraButton();
}

function draw() {
  if (cameraEnabled && video) {
    background(0);
    image(video, 0, 0, width, height);
  } else if (!permissionAsked) {
    background(0);
    fill(255);
    textSize(24);
    text('Please enable camera to start', width/2, height/2);
  }
}

function createCameraButton() {
  if (!permissionAsked) {
    cameraBtn = createButton('Enable Camera');
    cameraBtn.style('font-size', '20px');
    cameraBtn.style('padding', '12px 24px');
    cameraBtn.position(width/2 - 80, height/2 + 30);
    cameraBtn.mousePressed(() => {
      requestCameraAccess(cameraBtn);
    });
    permissionAsked = true;
  }
}

function requestCameraAccess(btn) {
  // Try to get user media with back camera
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "environment" } } })
    .then(function(stream) {
      if (video) video.remove();
      video = createCapture({
        video: {
          facingMode: { exact: "environment" }
        }
      }, () => {
        cameraEnabled = true;
        btn.remove();
      });
      video.size(windowWidth, windowHeight);
      video.hide();
    })
    .catch(function(err) {
      // fallback to default camera if environment not available
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
          if (video) video.remove();
          video = createCapture(VIDEO, () => {
            cameraEnabled = true;
            btn.remove();
          });
          video.size(windowWidth, windowHeight);
          video.hide();
        })
        .catch(function(err2) {
          cameraEnabled = false;
          fill(255,0,0);
          text('Camera access denied', width/2, height/2 + 60);
        });
    });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (video) {
    video.size(windowWidth, windowHeight);
  }
  if (cameraBtn) {
    cameraBtn.position(width/2 - 80, height/2 + 30);
  }
}