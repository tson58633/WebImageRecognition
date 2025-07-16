let video;
let cameraEnabled = false;
let permissionAsked = false;

function setup() {
  let canvas = createCanvas(600, 450);
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
    const btn = createButton('Enable Camera');
    btn.position(width/2 - 60, height/2 + 30);
    btn.mousePressed(() => {
      requestCameraAccess(btn);
    });
    permissionAsked = true;
  }
}

function requestCameraAccess(btn) {
  // Try to get user media
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(function(stream) {
      if (video) video.remove();
      video = createCapture(VIDEO, () => {
        cameraEnabled = true;
        btn.remove();
      });
      video.size(600, 450);
      video.hide();
    })
    .catch(function(err) {
      cameraEnabled = false;
      fill(255,0,0);
      text('Camera access denied', width/2, height/2 + 60);
    });
}