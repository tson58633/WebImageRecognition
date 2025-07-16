let video;
let classifier;
let label = "";
let confidence = 0;
let lastRedirect = 0;
const redirectDelay = 5000; // ms

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
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  video = createCapture({
    video: {
      facingMode: { exact: "environment" }
    }
  }, () => {
    classifyVideo();
  });
  video.size(windowWidth, windowHeight);
  video.hide();
  background(0);
  textAlign(CENTER, CENTER);
  textSize(24);
  fill(255);
  text('Loading camera...', width/2, height/2);
}

function draw() {
  background(0);
  if (video && video.loadedmetadata) {
    image(video, 0, 0, width, height);
  }
  fill(255, 0, 0);
  textSize(18);
  textAlign(RIGHT);
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
  // Redirect if confidence is high and not redirected recently
  if (confidence > 0.95 && labelToUrl[label] && Date.now() - lastRedirect > redirectDelay) {
    window.location.href = labelToUrl[label];
    lastRedirect = Date.now();
  }
  classifyVideo();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (video) {
    video.size(windowWidth, windowHeight);
  }
}