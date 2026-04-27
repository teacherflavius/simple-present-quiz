(function () {
  function injectBackground() {
    if (!document.getElementById("particles")) {
      var canvas = document.createElement("canvas");
      canvas.id = "particles";
      document.body.insertBefore(canvas, document.body.firstChild);
    }

    if (!document.querySelector(".aurora")) {
      var aurora = document.createElement("div");
      aurora.className = "aurora";
      aurora.innerHTML = '<div class="aurora-blob"></div><div class="aurora-blob"></div>';
      document.body.insertBefore(aurora, document.body.firstChild);
    }
  }

  function initParticles() {
    var canvas = document.getElementById("particles");
    if (!canvas || canvas.dataset.initialized === "true") return;
    canvas.dataset.initialized = "true";

    var ctx = canvas.getContext("2d");
    var W, H;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    var particles = Array.from({ length: 80 }, function () {
      var p = {};

      function reset(init) {
        p.x = Math.random() * W;
        p.y = init ? Math.random() * H : H + 8;
        p.r = Math.random() * 1.6 + 0.3;
        p.vy = -(Math.random() * 0.45 + 0.15);
        p.vx = (Math.random() - 0.5) * 0.25;
        p.alpha = 0;
        p.max = Math.random() * 0.5 + 0.08;
        p.fin = true;
        p.hue = Math.random() > 0.5 ? 238 : 260;
        p.reset = reset;
      }

      reset(true);

      p.update = function () {
        p.y += p.vy;
        p.x += p.vx;
        if (p.fin) {
          p.alpha += 0.007;
          if (p.alpha >= p.max) p.fin = false;
        } else {
          p.alpha -= 0.003;
        }
        if (p.alpha <= 0 || p.y < -8) p.reset(false);
      };

      p.draw = function () {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + p.hue + ",80%,75%," + p.alpha + ")";
        ctx.fill();
      };

      return p;
    });

    function loop() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(function (p) {
        p.update();
        p.draw();
      });
      requestAnimationFrame(loop);
    }

    loop();
  }

  function initTiltAndRipple() {
    document.querySelectorAll(".menu-button, .student-card, .professor-button").forEach(function (el) {
      if (el.dataset.animatedCardsBound === "true") return;
      el.dataset.animatedCardsBound = "true";

      if (el.classList.contains("menu-button") || el.classList.contains("student-card")) {
        el.addEventListener("mousemove", function (event) {
          var rect = el.getBoundingClientRect();
          var rx = ((event.clientY - rect.top) / rect.height - 0.5) * -10;
          var ry = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
          el.style.transform = "perspective(600px) translateY(-4px) scale(1.02) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
        });

        el.addEventListener("mouseleave", function () {
          el.style.transform = "";
        });
      }

      el.addEventListener("click", function (event) {
        var rect = el.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.cssText = "width:" + size + "px;height:" + size + "px;left:" + (event.clientX - rect.left - size / 2) + "px;top:" + (event.clientY - rect.top - size / 2) + "px";
        el.appendChild(ripple);
        setTimeout(function () { ripple.remove(); }, 600);
      });
    });
  }

  function init() {
    injectBackground();
    initParticles();
    initTiltAndRipple();

    var observer = new MutationObserver(function () {
      initTiltAndRipple();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
