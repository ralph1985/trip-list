const ICE_GATHERING_TIMEOUT = 8000;

function waitForIceGatheringComplete(peerConnection) {
  if (peerConnection.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = window.setTimeout(done, ICE_GATHERING_TIMEOUT);
    function done() {
      window.clearTimeout(timeout);
      peerConnection.removeEventListener("icegatheringstatechange", checkState);
      resolve();
    }
    function checkState() {
      if (peerConnection.iceGatheringState === "complete") done();
    }
    peerConnection.addEventListener("icegatheringstatechange", checkState);
  });
}

function serializeDescription(description) {
  return JSON.stringify({ type: description.type, sdp: description.sdp });
}

function parseDescription(value) {
  const description = JSON.parse(value);
  if (!description || !["offer", "answer"].includes(description.type) || typeof description.sdp !== "string") {
    throw new Error("El código no parece una oferta o respuesta válida.");
  }
  return description;
}

export function createPeerSync({ onMessage, onStatus }) {
  let peerConnection;
  let dataChannel;

  function status(value) {
    onStatus?.(value);
  }

  function close() {
    dataChannel?.close();
    peerConnection?.close();
    dataChannel = null;
    peerConnection = null;
  }

  function setupDataChannel(channel) {
    dataChannel = channel;
    dataChannel.addEventListener("open", () => status("connected"));
    dataChannel.addEventListener("close", () => status("closed"));
    dataChannel.addEventListener("error", () => status("error"));
    dataChannel.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "trip-list-state" && Array.isArray(message.checkedIds)) onMessage?.(message.checkedIds);
      } catch {
        status("error");
      }
    });
  }

  function createConnection() {
    if (!window.RTCPeerConnection) throw new Error("Este navegador no admite WebRTC.");
    peerConnection = new RTCPeerConnection({ iceServers: [] });
    peerConnection.addEventListener("connectionstatechange", () => {
      if (["failed", "disconnected"].includes(peerConnection.connectionState)) status("error");
    });
    return peerConnection;
  }

  async function createOffer() {
    close();
    const connection = createConnection();
    setupDataChannel(connection.createDataChannel("trip-list"));
    await connection.setLocalDescription(await connection.createOffer());
    status("gathering");
    await waitForIceGatheringComplete(connection);
    status("waiting");
    return serializeDescription(connection.localDescription);
  }

  async function acceptOffer(value) {
    close();
    const connection = createConnection();
    connection.addEventListener("datachannel", (event) => setupDataChannel(event.channel));
    await connection.setRemoteDescription(parseDescription(value));
    await connection.setLocalDescription(await connection.createAnswer());
    status("gathering");
    await waitForIceGatheringComplete(connection);
    status("waiting");
    return serializeDescription(connection.localDescription);
  }

  async function acceptAnswer(value) {
    if (!peerConnection) throw new Error("Primero tienes que crear una oferta.");
    await peerConnection.setRemoteDescription(parseDescription(value));
    status("connecting");
  }

  function send(checkedIds) {
    if (!dataChannel || dataChannel.readyState !== "open") throw new Error("La conexión todavía no está lista.");
    dataChannel.send(JSON.stringify({ type: "trip-list-state", checkedIds }));
  }

  return { acceptAnswer, acceptOffer, close, createOffer, send };
}
