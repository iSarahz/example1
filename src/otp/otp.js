/**
 * OTP input component.
 *
 * States (reflected on the root as data-state):
 *   empty    – no digits entered
 *   filling  – some digits entered
 *   complete – every digit entered
 *   error    – set via setError(); cleared on the next edit
 * Focus is per-cell (:focus / .is-focused). The resend timer runs alongside
 * any of the above.
 *
 * Usage:
 *   const otp = new OtpInput(el, {
 *     length: 6,
 *     resendSeconds: 30,
 *     onComplete: (code) => {},
 *     onResend: () => {},
 *   });
 */
(function (global) {
  "use strict";

  const DEFAULTS = {
    length: 6,
    label: "Enter verification code",
    hint: "",
    resendSeconds: 30,
    autoStartTimer: true,
    autoFocus: false,
    onChange: null,
    onComplete: null,
    onResend: null,
  };

  class OtpInput {
    constructor(root, options = {}) {
      this.root = root;
      this.options = { ...DEFAULTS, ...options };
      this.state = "empty";
      this.errorMessage = "";
      this.remaining = 0;
      this._timerId = null;

      this._render();
      this._bind();
      if (this.options.autoStartTimer && this.options.resendSeconds > 0) {
        this.startTimer();
      } else {
        this._renderResend();
      }
      if (this.options.autoFocus) this.focus();
    }

    // Public API

    get value() {
      return this.cells.map((cell) => cell.value).join("");
    }

    setValue(code) {
      const digits = String(code).replace(/\D/g, "").slice(0, this.options.length);
      this.cells.forEach((cell, i) => {
        cell.value = digits[i] || "";
      });
      this._update();
    }

    focus(index) {
      const i = index ?? Math.min(this.value.length, this.options.length - 1);
      this.cells[i].focus();
      this.cells[i].select();
    }

    setError(message = "Incorrect code. Please try again.") {
      this.errorMessage = message;
      this._setState("error");
      this.root.classList.remove("is-shaking");
      void this.root.offsetWidth; // restart the animation
      this.root.classList.add("is-shaking");
    }

    clearError() {
      if (this.state !== "error") return;
      this.errorMessage = "";
      this._update();
    }

    reset() {
      this.errorMessage = "";
      this.setValue("");
    }

    setDisabled(disabled) {
      this.cells.forEach((cell) => {
        cell.disabled = disabled;
      });
    }

    startTimer(seconds = this.options.resendSeconds) {
      this.stopTimer();
      this.remaining = seconds;
      this._renderResend();
      this._timerId = setInterval(() => {
        this.remaining -= 1;
        if (this.remaining <= 0) this.stopTimer();
        this._renderResend();
      }, 1000);
    }

    stopTimer() {
      clearInterval(this._timerId);
      this._timerId = null;
      if (this.remaining < 0) this.remaining = 0;
    }

    destroy() {
      this.stopTimer();
      this.root.innerHTML = "";
    }

    // Rendering

    _render() {
      const { length, label, hint } = this.options;
      const id = `otp-${Math.random().toString(36).slice(2, 8)}`;

      this.root.classList.add("otp");
      this.root.innerHTML = `
        <label class="otp__label" id="${id}-label">${label}</label>
        <div class="otp__cells" role="group" aria-labelledby="${id}-label"></div>
        <p class="otp__message" id="${id}-message" aria-live="polite">${hint}</p>
        <p class="otp__resend" aria-live="polite"></p>
      `;

      this.cellsEl = this.root.querySelector(".otp__cells");
      this.messageEl = this.root.querySelector(".otp__message");
      this.resendEl = this.root.querySelector(".otp__resend");

      this.cells = Array.from({ length }, (_, i) => {
        const cell = document.createElement("input");
        cell.className = "otp__cell";
        cell.type = "text";
        cell.inputMode = "numeric";
        cell.pattern = "[0-9]*";
        cell.maxLength = 1;
        cell.placeholder = "";
        cell.autocomplete = i === 0 ? "one-time-code" : "off";
        cell.setAttribute("aria-label", `Digit ${i + 1} of ${length}`);
        cell.setAttribute("aria-describedby", `${id}-message`);
        this.cellsEl.appendChild(cell);
        return cell;
      });

      this._setState("empty");
    }

    _renderResend() {
      if (!this.options.resendSeconds) {
        this.resendEl.hidden = true;
        return;
      }
      if (this.remaining > 0) {
        const m = String(Math.floor(this.remaining / 60)).padStart(2, "0");
        const s = String(this.remaining % 60).padStart(2, "0");
        this.resendEl.innerHTML =
          `Resend code in <span class="otp__timer">${m}:${s}</span>`;
      } else {
        this.resendEl.innerHTML =
          `Didn't receive a code? <button type="button" class="otp__resend-button">Resend code</button>`;
      }
    }

    _setState(state) {
      this.state = state;
      this.root.dataset.state = state;
      const invalid = state === "error";
      this.cells.forEach((cell) => {
        cell.classList.toggle("is-filled", cell.value !== "");
        cell.setAttribute("aria-invalid", String(invalid));
      });
      this.messageEl.textContent = invalid ? this.errorMessage : this.options.hint;
    }

    _update() {
      const filled = this.value.length;
      const state =
        filled === 0 ? "empty" : filled === this.options.length ? "complete" : "filling";
      const previous = this.state;
      this.errorMessage = "";
      this._setState(state);

      if (this.options.onChange) this.options.onChange(this.value);
      if (state === "complete" && previous !== "complete" && this.options.onComplete) {
        this.options.onComplete(this.value);
      }
    }

    // Events

    _bind() {
      this.cells.forEach((cell, i) => {
        cell.addEventListener("focus", () => cell.select());
        cell.addEventListener("input", (e) => this._onInput(e, i));
        cell.addEventListener("keydown", (e) => this._onKeyDown(e, i));
        cell.addEventListener("paste", (e) => this._onPaste(e, i));
      });
      this.cellsEl.addEventListener("animationend", () => {
        this.root.classList.remove("is-shaking");
      });
      this.resendEl.addEventListener("click", (e) => {
        if (!e.target.closest(".otp__resend-button")) return;
        this.reset();
        this.startTimer();
        this.focus(0);
        if (this.options.onResend) this.options.onResend();
      });
    }

    _onInput(e, i) {
      const cell = this.cells[i];
      const digits = cell.value.replace(/\D/g, "");

      // Autofill (e.g. iOS one-time-code) can drop the whole code into one cell.
      if (digits.length > 1) {
        this._fillFrom(i, digits);
        return;
      }

      cell.value = digits;
      this._update();
      if (digits && i < this.cells.length - 1) this.focus(i + 1);
    }

    _onKeyDown(e, i) {
      const cell = this.cells[i];
      switch (e.key) {
        case "Backspace":
          if (cell.value) {
            cell.value = "";
            this._update();
          } else if (i > 0) {
            this.cells[i - 1].value = "";
            this._update();
            this.focus(i - 1);
          }
          e.preventDefault();
          break;
        case "Delete":
          cell.value = "";
          this._update();
          e.preventDefault();
          break;
        case "ArrowLeft":
          if (i > 0) this.focus(i - 1);
          e.preventDefault();
          break;
        case "ArrowRight":
          if (i < this.cells.length - 1) this.focus(i + 1);
          e.preventDefault();
          break;
        default:
          // Typing a digit into an already-filled cell replaces it.
          if (/^\d$/.test(e.key) && cell.value) {
            cell.value = "";
          }
      }
    }

    _onPaste(e, i) {
      e.preventDefault();
      const text = (e.clipboardData || global.clipboardData).getData("text");
      const digits = text.replace(/\D/g, "");
      if (digits) this._fillFrom(i, digits);
    }

    _fillFrom(start, digits) {
      const chars = digits.slice(0, this.cells.length - start).split("");
      chars.forEach((d, k) => {
        this.cells[start + k].value = d;
      });
      this._update();
      this.focus(Math.min(start + chars.length, this.cells.length - 1));
    }
  }

  global.OtpInput = OtpInput;
  if (typeof module !== "undefined" && module.exports) module.exports = OtpInput;
})(typeof window !== "undefined" ? window : globalThis);
