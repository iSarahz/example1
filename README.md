# example1
## OTP input

A dependency-free OTP component in `src/otp/` (`otp.css` + `otp.js`) that supports
these states: **Empty, Filling, Focus, Complete, Error, Resend timer**.

Open `index.html` in a browser to see every state plus an interactive demo.

```html
<link rel="stylesheet" href="src/otp/otp.css" />
<div id="otp"></div>
<script src="src/otp/otp.js"></script>
<script>
  const otp = new OtpInput(document.getElementById("otp"), {
    length: 6,
    resendSeconds: 30,
    onComplete: (code) => verify(code).catch(() => otp.setError("Incorrect code")),
    onResend: () => sendCode(),
  });
</script>
```

Visual values (sizes, radius, colors) are CSS custom properties at the top of `otp.css`.
