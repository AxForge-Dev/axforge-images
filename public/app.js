// AxForge images starter: the page. "Make it" asks the local server for a new image
// (ERNIE Image Turbo); "Change the image" sends the current image and an instruction
// (FLUX.2 Klein). Both come back as base64 PNG in data[0].b64_json.

const $ = (id) => document.getElementById(id);
const status = $("status");
let current = null; // the image on show, as a data URL

function show(dataUrl) {
  current = dataUrl;
  $("current").className = "current";
  $("current").innerHTML = "";
  const img = new Image();
  img.src = dataUrl;
  img.alt = "The current image";
  $("current").appendChild(img);
  $("download").href = dataUrl;
  $("download").hidden = false;
  $("edit-btn").disabled = false;

  // Keep earlier images as small thumbnails; a click brings one back.
  const thumb = new Image();
  thumb.src = dataUrl;
  thumb.alt = "An earlier image";
  thumb.onclick = () => show(dataUrl);
  $("history").prepend(thumb);
}

async function call(path, payload, busyText) {
  const buttons = document.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  const started = Date.now();
  status.textContent = busyText;
  const timer = setInterval(() => (status.textContent = `${busyText} ${Math.round((Date.now() - started) / 1000)} s`), 1000);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error?.message || body.message || `${res.status} ${res.statusText}`);
    show(`data:image/png;base64,${body.data[0].b64_json}`);
    status.textContent = `Done in ${Math.round((Date.now() - started) / 1000)} s.`;
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  } finally {
    clearInterval(timer);
    buttons.forEach((b) => (b.disabled = false));
    $("edit-btn").disabled = !current;
  }
}

$("generate").addEventListener("submit", (e) => {
  e.preventDefault();
  call("/api/generate", { prompt: $("prompt").value.trim(), size: $("size").value }, "Making the image…");
});

$("edit").addEventListener("submit", (e) => {
  e.preventDefault();
  if (current) call("/api/edit", { prompt: $("instruction").value.trim(), image: current }, "Changing the image…");
});

// Your own image: scaled down to at most 1536 pixels a side first, which keeps the upload small.
$("upload").addEventListener("change", () => {
  const file = $("upload").files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 1536 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    show(canvas.toDataURL("image/png"));
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
});
