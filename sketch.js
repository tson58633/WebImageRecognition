let video;
let classifier;
let label = "";
let confidence = 0;
let lastRedirect = 0;
const redirectDelay = 5000; // ms
let allResults = [];

// Canvas and video sizing
let camW, camH, debugW;

// Map class labels to URLs
const labelToUrl = {
  "Class 1": "https://example.com/first",
  "Class 2": "https://example.com/second",
  "Class 3": "https://example.com/third"
};

function preload() {
  // Load your Teachable Machine model
  classifier = ml5.imageClassifier('https://teachablemachine.withgoogle.com/models/ZiBmsUhJE/model.json');
}

function setup() {
  camW = Math.floor(windowWidth * 0.8);
  camH = windowHeight;
  debugW = windowWidth - camW;
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  video = createCapture({
    video: {
      facingMode: { exact: "environment" }
    }
  }, () => {
    classifyVideo();
  });
  video.size(camW, camH);
  video.hide();
  background(0);
  textAlign(CENTER, CENTER);
  textSize(24);
  fill(255);
  text('Loading camera...', width/2, height/2);
}

function draw() {
  background(0);
  // Draw camera feed on left 80%
  if (video && video.loadedmetadata) {
    image(video, 0, 0, camW, camH);
  }
  // Draw debug panel background
  fill(30, 30, 30, 220);
  noStroke();
  rect(camW, 0, debugW, height);

  // Debug: Show all class similarities in the right panel
  fill(0, 255, 0);
  textSize(18);
  textAlign(LEFT, TOP);
  let y = 30;
  let x = camW + 20;
  text('Class Similarities:', x, y);
  y += 32;
  for (let i = 0; i < allResults.length; i++) {
    let c = allResults[i];
    text(`${c.label}: ${(c.confidence*100).toFixed(2)}%`, x, y);
    y += 28;
  }
  // Show top label at the bottom right
  fill(255, 0, 0);
  textSize(18);
  textAlign(RIGHT, BOTTOM);
  text(label + (confidence ? ` (${(confidence*100).toFixed(1)}%)` : ''), width - 10, height - 10);
}

function classifyVideo() {
  classifier.classify(video, gotResult);
}

function gotResult(error, results) {
  if (error) {
    console.error(error);
    return;
  }
  label = results[0].label;
  confidence = results[0].confidence;
  allResults = results;
  // Redirect if confidence is high and not redirected recently
  if (confidence > 0.95 && labelToUrl[label] && Date.now() - lastRedirect > redirectDelay) {
    window.location.href = labelToUrl[label];
    lastRedirect = Date.now();
  }
  classifyVideo();
}

function windowResized() {
  camW = Math.floor(windowWidth * 0.8);
  camH = windowHeight;
  debugW = windowWidth - camW;
  resizeCanvas(windowWidth, windowHeight);
  if (video) {
    video.size(camW, camH);
  }
}