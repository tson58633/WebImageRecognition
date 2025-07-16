// === Teachable Machine 模型設定 ===
const modelURL = 'https://teachablemachine.withgoogle.com/models/3GR__7Yne/';
const checkpointURL = modelURL + "model.json";
const metadataURL = modelURL + "metadata.json";

let model;
let totalClasses;
let video;
let classification = "None Yet";
let lastClassification = "";
let score = 0;
let totalSimilarityScore = 0;
let startTime;
let moveCount = 0;
let gameEnded = true; // 初始為 true，防止自動運行

let socket; // WebSocket 物件

// TM 檢測管理器
let tmDetectionManager = null;

//Class 1 企 Stand
//Class 2 深蹲 Squat
//Class 3 開合跳 Jumping Jack
//Class 4 跳跑 March With Skip
//Class 5 高抬膝 High Knee Up 
//Class 6 抬膝拍掌 Knee Up Clap

//===Skill with Order Index===
//TM_01 Name: 炙牙  Pose Order=1:Squat 2:High Knee Up  3:Squat 4:High Knee Up  5:Squat 6:High Knee Up 
//TM_02 Name: 回漩爪 Pose Order=1:Squat 2:Squat 3:Jumping Jack 4:Jumping Jack 5:Squat 6:Squat
//TM_03
//TM_04
//TM_05
//TM_06

// === TM 檢測類 ===
class TMDetection {
  constructor(tmId, name, poseOrder) {
    this.tmId = tmId; // 例如: "TM_01"
    this.name = name; // 例如: "炙牙"
    this.poseOrder = poseOrder; // 姿勢順序陣列
    this.isActive = false;
    this.currentPoseIndex = 0;
    this.poseSimilarities = [];
    this.countdownStartTime = 0;
    this.isInCountdown = false;
    this.maxSimilarityInCountdown = 0;
    this.targetPoseClass = "";
    this.startTime = 0; // 添加開始時間記錄
    this.currentSimilarity = 0; // 添加當前相似度追蹤
  }

  start() {
    this.isActive = true;
    this.currentPoseIndex = 0;
    this.poseSimilarities = [];
    this.isInCountdown = false;
    this.maxSimilarityInCountdown = 0;
    this.startTime = millis(); // 記錄開始時間
    
    // 設定第一個目標姿勢
    if (this.currentPoseIndex < this.poseOrder.length) {
      this.targetPoseClass = this.poseOrder[this.currentPoseIndex];
      console.log(`🎯 開始檢測 ${this.tmId} (${this.name}) Pose ${this.currentPoseIndex + 1}: ${this.targetPoseClass}`);
    }
  }

  end() {
    this.isActive = false;
    this.isInCountdown = false;
    
    // 計算平均相似度
    const averageSimilarity = this.poseSimilarities.length > 0 
      ? this.poseSimilarities.reduce((sum, sim) => sum + sim, 0) / this.poseSimilarities.length 
      : 0;
    
    console.log(`🏁 ${this.tmId} (${this.name}) 檢測完成！`);
    console.log("各姿勢相似度:", this.poseSimilarities.map((sim, i) => `Pose ${i+1}: ${(sim*100).toFixed(1)}%`));
    console.log("平均相似度:", (averageSimilarity * 100).toFixed(1) + "%");
    
    // 發送完成訊息給 Unreal Engine
    if (socket && socket.readyState === WebSocket.OPEN) {
      // 統一格式: TM_01,Pose_0,AverSim:85
      socket.send(`${this.tmId},Pose_0,AverSim:${Math.round(averageSimilarity * 100)}`);
    }
  }

  // 添加停止檢測的方法
  stop() {
    this.isActive = false;
    this.isInCountdown = false;
    
    console.log(`⏹️ ${this.tmId} (${this.name}) 檢測已停止`);
    
    // 發送停止訊息給 Unreal Engine
    if (socket && socket.readyState === WebSocket.OPEN) {
      // 計算已完成姿勢的平均相似度
      const completedAverage = this.poseSimilarities.length > 0 ? 
        Math.round((this.poseSimilarities.reduce((sum, sim) => sum + sim, 0) / this.poseSimilarities.length) * 100) : 0;
      // 統一格式: TM_01,Pose_0,AverSim:85
      socket.send(`${this.tmId},Pose_0,AverSim:${completedAverage}`);
      // 若要發送已完成姿勢數量可加上: socket.send(`${this.tmId},CompletedPoses:${this.poseSimilarities.length}`);
    }
  }

  handlePrediction(sortedPrediction) {
    if (this.currentPoseIndex >= this.poseOrder.length) {
      this.end();
      return;
    }

    const targetClass = this.poseOrder[this.currentPoseIndex];
    const targetPrediction = sortedPrediction.find(p => p.className === targetClass);
    const currentSimilarity = targetPrediction ? targetPrediction.probability : 0;
    
    // 更新當前相似度
    this.currentSimilarity = currentSimilarity;

    if (!this.isInCountdown) {
      // 檢查是否達到70%相似度
      if (currentSimilarity >= 0.7) {
        console.log(`🎯 檢測到目標姿勢 ${targetClass}，相似度: ${(currentSimilarity * 100).toFixed(1)}%`);
        this.startCountdown(currentSimilarity);
      }
    } else {
      // 在倒數期間記錄最高相似度
      if (currentSimilarity > this.maxSimilarityInCountdown) {
        this.maxSimilarityInCountdown = currentSimilarity;
      }

      // 檢查倒數是否結束
      let countdownTime = 1.0 - ((millis() - this.countdownStartTime) / 1000);
      if (countdownTime <= 0) {
        this.endCountdown();
      }
    }
  }

  startCountdown(initialSimilarity) {
    this.isInCountdown = true;
    this.countdownStartTime = millis();
    this.maxSimilarityInCountdown = initialSimilarity;
    console.log("⏰ 開始1秒倒數，記錄最高相似度...");
  }

  endCountdown() {
    this.isInCountdown = false;
    
    // 儲存當前姿勢的相似度
    this.poseSimilarities.push(this.maxSimilarityInCountdown);
    
    // 發送當前姿勢的相似度給 Unreal Engine
    const similarityPercent = (this.maxSimilarityInCountdown * 100).toFixed(0);
    // 單一 pose 完成時格式: TM_01,Pose_1,Sim:87
    const message = `${this.tmId},Pose_${this.currentPoseIndex + 1},Sim:${similarityPercent}`;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
    
    console.log(`✅ ${this.tmId} Pose ${this.currentPoseIndex + 1} 完成，相似度: ${similarityPercent}%`);
    console.log(`📤 發送給 Unreal Engine: ${message}`);
    
    // 進入下一個姿勢
    this.currentPoseIndex++;
    if (this.currentPoseIndex < this.poseOrder.length) {
      this.targetPoseClass = this.poseOrder[this.currentPoseIndex];
      console.log(`🎯 開始檢測 ${this.tmId} Pose ${this.currentPoseIndex + 1}: ${this.targetPoseClass}`);
    }
  }

  isActive() {
    return this.isActive;
  }

  getTargetPoseClass() {
    return this.targetPoseClass;
  }

  getCurrentPoseIndex() {
    return this.currentPoseIndex;
  }

  getPoseSimilarities() {
    return this.poseSimilarities;
  }

  isInCountdownMode() {
    return this.isInCountdown;
  }

  getCountdownTime() {
    if (!this.isInCountdown) return 0;
    return 1.0 - ((millis() - this.countdownStartTime) / 1000);
  }

  getMaxSimilarityInCountdown() {
    return this.maxSimilarityInCountdown;
  }

  // 添加獲取經過時間的方法
  getElapsedTime() {
    if (!this.isActive || this.startTime === 0) return 0;
    return (millis() - this.startTime) / 1000; // 返回秒數
  }

  // 添加格式化時間的方法
  getFormattedTime() {
    const elapsedSeconds = this.getElapsedTime();
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = Math.floor(elapsedSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 添加獲取當前相似度的方法
  getCurrentSimilarity() {
    return this.currentSimilarity;
  }

  // 添加獲取當前相似度百分比的方法
  getCurrentSimilarityPercent() {
    return (this.currentSimilarity * 100).toFixed(1);
  }
}

// === TM 檢測管理器類 ===
class TMDetectionManager {
  constructor() {
    this.detections = new Map();
    this.activeDetection = null;
    this.initializeDetections();
  }

  initializeDetections() {
    // 初始化所有TM檢測模式
    this.detections.set("TM_01", new TMDetection(
      "TM_01", 
      "炙牙", 
      ["Class 2", "Class 5", "Class 2", "Class 5", "Class 2", "Class 5"] // Squat, High Knee Up, Squat, High Knee Up, Squat, High Knee Up
    ));

    this.detections.set("TM_02", new TMDetection(
      "TM_02", 
      "回漩爪", 
      ["Class 2", "Class 2", "Class 3", "Class 3", "Class 2", "Class 2"] // Squat, Squat, Jumping Jack, Jumping Jack, Squat, Squat
    ));

    // 可以繼續添加 TM_03, TM_04, TM_05, TM_06
    this.detections.set("TM_03", new TMDetection(
      "TM_03", 
      "未命名", 
      ["Class 2", "Class 2", "Class 2", "Class 4", "Class 4", "Class 4"] // Squat, Squat, Squat, March With Skip, March With Skip, March With Skip  
    ));

    this.detections.set("TM_04", new TMDetection(
      "TM_04", 
      "未命名", 
      ["Class 1", "Class 1", "Class 1", "Class 1", "Class 1", "Class 1"] // 預設為站立
    ));

    this.detections.set("TM_05", new TMDetection(
      "TM_05", 
      "未命名", 
      ["Class 1", "Class 1", "Class 1", "Class 1", "Class 1", "Class 1"] // 預設為站立
    ));

    this.detections.set("TM_06", new TMDetection(
      "TM_06", 
      "未命名", 
      ["Class 1", "Class 1", "Class 1", "Class 1", "Class 1", "Class 1"] // 預設為站立
    ));

    this.detections.set("TM_07", new TMDetection(
      "TM_07", 
      "新技能名稱", 
      ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"]
    ));
  }

  startDetection(tmId) {
    const detection = this.detections.get(tmId);
    if (detection) {
      // 停止當前檢測（如果有的話）
      if (this.activeDetection) {
        this.activeDetection.isActive = false;
      }
      
      this.activeDetection = detection;
      detection.start();
      
      // 啟動預測循環
      if (!isLooping()) {
        loop();
      }
      predict();
      
      return true;
    } else {
      console.error(`❌ 未找到 ${tmId} 的檢測配置`);
      return false;
    }
  }

  // 添加停止檢測的方法
  stopDetection() {
    if (this.activeDetection && this.activeDetection.isActive) {
      this.activeDetection.stop();
      this.activeDetection = null;
      
      // 如果沒有其他活動的檢測，停止繪圖循環
      if (!this.isAnyDetectionActive()) {
        noLoop();
      }
      
      return true;
    } else {
      console.log("⚠️ 沒有正在進行的檢測可以停止");
      return false;
    }
  }

  getActiveDetection() {
    return this.activeDetection;
  }

  isAnyDetectionActive() {
    return this.activeDetection && this.activeDetection.isActive;
  }

  handlePrediction(sortedPrediction) {
    if (this.activeDetection && this.activeDetection.isActive) {
      this.activeDetection.handlePrediction(sortedPrediction);
    }
  }
}

// === 載入模型 ===
async function load() {
  model = await tmPose.load(checkpointURL, metadataURL);
  totalClasses = model.getTotalClasses();
  console.log("Model loaded successfully.");
}

// === 初始設定 ===
async function setup() {
  createCanvas(600, 450);
  video = createCapture(VIDEO);
  video.size(600, 450);
  video.hide();

  await load();

  // 初始化 TM 檢測管理器
  tmDetectionManager = new TMDetectionManager();

  // 建立 WebSocket 連線
  socket = new WebSocket('ws://localhost:8080');

  socket.onopen = () => {
    console.log("✅ Connected to WebSocket server");
    socket.send(JSON.stringify({ test: "hello from p5.js" }));
  };

  socket.onmessage = (event) => {
    const message = event.data.trim(); // 去除空白
    if (message === "Start") {
      console.log("✅ 收到 Unreal 純文字指令：開始遊戲");
      gameEnded = false;
      score = 0;
      moveCount = 0;
      totalSimilarityScore = 0;
      startTime = millis();
      loop();        // 啟動 draw()
      predict();     // 啟動預測
    } else if (message === "TM_Stop") {
      // 處理停止TM檢測指令
      console.log("⏹️ 收到 TM_Stop 指令：停止當前TM檢測");
      const success = tmDetectionManager.stopDetection();
      if (!success) {
        console.log("⚠️ 沒有正在進行的TM檢測可以停止");
      }
    } else if (message.startsWith("TM_")) {
      // 處理所有TM檢測指令 (TM_01, TM_02, TM_03, etc.)
      console.log(`✅ 收到 ${message} 指令：開始 ${message} 檢測`);
      const success = tmDetectionManager.startDetection(message);
      if (!success) {
        console.error(`❌ 無法啟動 ${message} 檢測`);
      }
    } else {
      console.log("⚠️ 收到未定義的文字訊息：", message);
    }
  };

  socket.onclose = () => {
    console.log("❌ Disconnected from WebSocket server");
  };

  socket.onerror = (error) => {
    console.error("⚠️ WebSocket error:", error);
  };

  noLoop(); // 初始停止 draw()
}

// === 繪圖區域 ===
function draw() {
  if (gameEnded && !tmDetectionManager.isAnyDetectionActive()) return; // 如果遊戲結束且沒有TM檢測，停止繪圖

  background(255);
  image(video, 0, 0);

  fill(0);
  textSize(18);
  text("Current: " + classification, 10, 40);
  
  if (tmDetectionManager.isAnyDetectionActive()) {
    const activeDetection = tmDetectionManager.getActiveDetection();
    
    // TM 檢測模式顯示
    text(`${activeDetection.tmId} (${activeDetection.name}) 檢測模式`, 10, 60);
    text("目標姿勢: " + activeDetection.getTargetPoseClass(), 10, 80);
    text("當前進度: " + (activeDetection.getCurrentPoseIndex() + 1) + "/6", 10, 100);
    
    // 添加計時器顯示
    text("檢測時間: " + activeDetection.getFormattedTime(), 10, 120);
    
    // 添加當前相似度顯示
    text("當前相似度: " + activeDetection.getCurrentSimilarityPercent() + "%", 10, 140);
    
    if (activeDetection.isInCountdownMode()) {
      let countdownTime = activeDetection.getCountdownTime();
      if (countdownTime > 0) {
        text("倒數: " + countdownTime.toFixed(1) + "s", 10, 160);
        text("最高相似度: " + (activeDetection.getMaxSimilarityInCountdown() * 100).toFixed(1) + "%", 10, 180);
      }
    }
    
    // 顯示已完成的姿勢相似度
    const poseSimilarities = activeDetection.getPoseSimilarities();
    for (let i = 0; i < poseSimilarities.length; i++) {
      text(`Pose ${i+1}: ${(poseSimilarities[i] * 100).toFixed(1)}%`, 10, 200 + i * 20);
    }
  } else {
    // 原本的遊戲模式顯示
    text("Score: " + score, 10, 60);
    text("Moves: " + moveCount + "/6", 10, 80);

    let elapsedTime = (millis() - startTime) / 1000;

    if ((moveCount >= 6 || elapsedTime > 15) && !gameEnded) {
      gameEnded = true;
      noLoop();
      console.log("遊戲結束！最終分數: " + score);
      console.log("總相似度分數: " + totalSimilarityScore.toFixed(2));

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          event: "gameEnd",
          finalScore: score,
          similarityScore: totalSimilarityScore
        }));
      }
    }
  }
}

// === 預測函式 ===
async function predict() {
  if (gameEnded && !tmDetectionManager.isAnyDetectionActive()) return;

  const flipHorizontal = false;
  const { pose, posenetOutput } = await model.estimatePose(video.elt, flipHorizontal);
  const prediction = await model.predict(posenetOutput, flipHorizontal, totalClasses);
  const sortedPrediction = prediction.sort((a, b) => -a.probability + b.probability);

  classification = sortedPrediction[0].className;

  if (tmDetectionManager.isAnyDetectionActive()) {
    // TM 檢測模式
    tmDetectionManager.handlePrediction(sortedPrediction);
  } else {
    // 原本的遊戲模式
    handleGamePrediction(sortedPrediction);
  }

  // 繼續預測循環
  if (!gameEnded || tmDetectionManager.isAnyDetectionActive()) {
    setTimeout(predict, 100);
  }
}

function handleGamePrediction(sortedPrediction) {
  if (classification !== lastClassification && lastClassification !== "") {
    console.log("從 " + lastClassification + " 變為 " + classification);  
    if ((lastClassification === "Class 1" || lastClassification === "Class 3") &&
        ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"].includes(classification) &&
        classification !== lastClassification) {
      score++;
      const similarity = sortedPrediction[0].probability;
      totalSimilarityScore += similarity;
      moveCount++;

      console.log("加分！目前分數: " + score + "，相似度: " + (similarity * 100).toFixed(2) + "%");
    }

    lastClassification = classification;
  } else if (lastClassification === "") {
    lastClassification = classification;
  }
}