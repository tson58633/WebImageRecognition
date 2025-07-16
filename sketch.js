// Image Classifier Variables
let classifier;
let imageModelURL = 'https://teachablemachine.withgoogle.com/models/ZiBmsUhJE/'; // Your image model

let video;
let flippedVideo;
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
  classifier = ml5.imageClassifier(imageModelURL + 'model.json');
}

function setup() {
  let canvas = createCanvas(600, 450);
  canvas.parent('canvas-container');
  video = createCapture(VIDEO);
  video.size(600, 450);
  video.hide();
  flippedVideo = ml5.flipImage(video);
  classifyVideo();
}

function draw() {
  background(0);
  image(flippedVideo, 0, 0);
  fill(255, 0, 0);
  textSize(18);
  textAlign(RIGHT);
  text(label + (confidence ? ` (${(confidence*100).toFixed(1)}%)` : ''), width - 10, height - 10);
}

function classifyVideo() {
  flippedVideo = ml5.flipImage(video);
  classifier.classify(flippedVideo, gotResult);
  flippedVideo.remove();
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