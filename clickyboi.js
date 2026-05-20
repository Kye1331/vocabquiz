// click-lock.js
// Press "7" to lock the current mouse position.
// Every subsequent "7" press simulates a click at that locked position.

(function () {
  let lockedX = null;
  let lockedY = null;
  let locked = false;

  document.addEventListener("mousemove", (e) => {
    if (!locked) {
      lockedX = e.clientX;
      lockedY = e.clientY;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "7") return;

    if (!locked) {
      locked = true;
      console.log(`Position locked at (${lockedX}, ${lockedY})`);
    } else {
      simulateClick(lockedX, lockedY);
      console.log(`Click simulated at (${lockedX}, ${lockedY})`);
    }
  });

  function simulateClick(x, y) {
    const target = document.elementFromPoint(x, y);
    if (!target) return;

    const eventOptions = {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      screenX: x + window.screenX,
      screenY: y + window.screenY,
    };

    target.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    target.dispatchEvent(new MouseEvent("mouseup", eventOptions));
    target.dispatchEvent(new MouseEvent("click", eventOptions));
  }
})();
