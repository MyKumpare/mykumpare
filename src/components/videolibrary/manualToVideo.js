/**
 * Creates a narrated slideshow video from scenes and a narration audio track.
 * Uses canvas + MediaRecorder API (client-side, no backend video processing).
 *
 * @param {Array} slides — [{ title, narration, bullets, isIntro }]
 * @param {string} narrationAudioUrl — URL of the narration MP3
 * @param {function} onProgress — (current, total) => void
 * @returns {Promise<Blob>} — video blob (webm)
 */
export async function createSlideshowVideo(slides, narrationAudioUrl, onProgress) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Your browser does not support video recording. Please use Chrome, Edge, or Firefox.");
  }
  if (!HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Your browser does not support canvas capture. Please use Chrome, Edge, or Firefox.");
  }

  // Wait for fonts (with timeout fallback)
  await Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, 2000)),
  ]);

  // Set up canvas
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");

  // Load narration audio
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    audio.onloadedmetadata = () => resolve();
    audio.onerror = () => reject(new Error("Could not load narration audio."));
    audio.src = narrationAudioUrl;
  });

  const totalDuration = audio.duration;
  if (!totalDuration || !isFinite(totalDuration) || totalDuration < 1) {
    throw new Error("Narration audio is too short or could not be loaded.");
  }

  // Set up canvas capture stream
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);

  // Set up audio routing through AudioContext
  const audioContext = new AudioContext();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  const sourceNode = audioContext.createMediaElementSource(audio);
  const audioDest = audioContext.createMediaStreamDestination();
  sourceNode.connect(audioDest);

  const audioTrack = audioDest.stream.getAudioTracks()[0];
  if (audioTrack) canvasStream.addTrack(audioTrack);

  // Set up MediaRecorder
  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) {
    throw new Error("Your browser does not support a compatible video recording format.");
  }
  const recorder = new MediaRecorder(canvasStream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const finished = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  // Start recording and audio
  recorder.start();
  audio.play();

  // Draw slides in sync with audio
  const perSlide = totalDuration / slides.length;
  let currentSlide = 0;
  const startTime = performance.now();

  // Draw initial slide
  drawSlide(ctx, slides[0], 0, slides.length);
  if (onProgress) onProgress(1, slides.length);

  await new Promise((resolve) => {
    function draw() {
      const elapsed = (performance.now() - startTime) / 1000;
      const slideIndex = Math.min(Math.floor(elapsed / perSlide), slides.length - 1);

      if (slideIndex !== currentSlide) {
        currentSlide = slideIndex;
        if (onProgress) onProgress(currentSlide + 1, slides.length);
      }

      drawSlide(ctx, slides[currentSlide], currentSlide, slides.length);

      if (elapsed < totalDuration) {
        requestAnimationFrame(draw);
      } else {
        resolve();
      }
    }
    draw();
  });

  // Stop recording
  recorder.stop();
  const blob = await finished;

  // Clean up
  audio.pause();
  try { audioContext.close(); } catch {}
  canvasStream.getTracks().forEach((t) => t.stop());

  return blob;
}

/**
 * Wraps text to fit within a maximum width on a canvas context.
 */
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + " " + words[i];
    if (ctx.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Draws a single slide on the canvas.
 */
function drawSlide(ctx, slide, index, total) {
  const W = 1280;
  const H = 720;
  const isIntro = index === 0;

  // Background
  ctx.fillStyle = "#1e1b4b";
  ctx.fillRect(0, 0, W, H);

  // Accent gradient bar at top
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "#6366f1");
  grad.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 8);

  if (isIntro) {
    // ── Title slide ──
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px 'Plus Jakarta Sans', Inter, sans-serif";
    ctx.textAlign = "center";
    const titleLines = wrapText(ctx, slide.title || "Training Video", 1000);
    const titleStartY = 300 - ((titleLines.length - 1) * 60) / 2;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, titleStartY + i * 60);
    });

    // Intro text
    if (slide.narration) {
      ctx.font = "26px Inter, sans-serif";
      ctx.fillStyle = "#c7d2fe";
      const introLines = wrapText(ctx, slide.narration, 900);
      const introStartY = 420;
      introLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, introStartY + i * 38);
      });
    }
  } else {
    // ── Content slide ──
    // Step label
    ctx.fillStyle = "#818cf8";
    ctx.font = "bold 22px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`STEP ${index}`, 80, 90);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px 'Plus Jakarta Sans', Inter, sans-serif";
    const titleLines = wrapText(ctx, slide.title || "", 1120);
    const titleY = 130;
    titleLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, 80, titleY + i * 50);
    });

    // Bullets
    ctx.font = "28px Inter, sans-serif";
    const bullets = slide.bullets || [];
    let bulletY = titleY + titleLines.length * 50 + 20;
    bullets.slice(0, 5).forEach((bullet) => {
      // Bullet dot
      ctx.fillStyle = "#818cf8";
      ctx.beginPath();
      ctx.arc(95, bulletY - 10, 6, 0, Math.PI * 2);
      ctx.fill();

      // Bullet text
      ctx.fillStyle = "#e0e7ff";
      const bulletLines = wrapText(ctx, bullet, 1050);
      bulletLines.slice(0, 2).forEach((line, j) => {
        ctx.fillText(line, 120, bulletY + j * 36);
      });
      bulletY += Math.max(50, Math.min(bulletLines.length, 2) * 36 + 16);
    });
  }

  // Footer: branding
  ctx.font = "18px Inter, sans-serif";
  ctx.fillStyle = "#6366f1";
  ctx.textAlign = "left";
  ctx.fillText("Powered by MyKumpare", 80, H - 30);

  // Footer: progress
  ctx.textAlign = "right";
  ctx.fillStyle = "#818cf8";
  ctx.fillText(`${index + 1} / ${total}`, W - 80, H - 30);
}