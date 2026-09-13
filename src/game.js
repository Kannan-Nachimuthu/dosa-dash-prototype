const WIDTH = 360;
const HEIGHT = 640;

class DosaGame extends Phaser.Scene {
  constructor() {
    super('DosaDash');
  }

  preload() {
  }

  create() {
    // Audio helper (no external files): simple beep using WebAudio
    this.audioCtx = null;
    this.playBeep = (freq = 440, duration = 0.08, vol = 0.05) => {
      try {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this.audioCtx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(vol, ctx.currentTime);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + duration);
      } catch (e) {
        // audio may be blocked on some browsers until user gesture
      }
    };

    // Simple state
    this.currency = parseInt(localStorage.getItem('dosa_currency') || '0');
    this.upgrades = JSON.parse(localStorage.getItem('dosa_upgrades') || JSON.stringify({pourSpeed:1,skilletSize:1,garnishSpeed:1}));

    // Background
    this.cameras.main.setBackgroundColor(0xf7e9d9);

    // Draw counter and stations
    this.createStations();

    // Orders
    this.orders = [];
    this.spawnInterval = 3000; // ms

    // Current active order
    this.currentOrder = null;

    // Score & UI
    this.scoreText = this.add.text(10, 10, `Coins: ${this.currency}`, { font: '16px Arial', fill:'#222' });
    this.streakText = this.add.text(10, 30, `Served: 0`, { font: '12px Arial', fill:'#222' });
    this.servedCount = 0;

    // Instruction text
    this.instruction = this.add.text(WIDTH/2, HEIGHT-30, '', { font:'12px Arial', fill:'#333' }).setOrigin(0.5);

    // Upgrade buttons
    this.createUpgrades();

    // Input handlers
    this.input.on('pointerdown', (p) => { this.pointerDown(p); });
    this.input.on('pointerup', (p) => { this.pointerUp(p); });
    this.input.on('pointermove', (p) => { this.pointerMove(p); });

    // Particle manager for flip/serve effects
    this.particles = this.add.particles('particle');
    // We don't load a texture; create a small graphics texture for particles
    const g = this.add.graphics();
    g.fillStyle(0xffdf9a, 1);
    g.fillCircle(3,3,3);
    g.generateTexture('particle', 6, 6);
    g.destroy();

    // Tutorial system (step-by-step guided onboarding)
    this.tutorial = {
      active: true,
      step: 0, // 0: pour, 1: spread, 2: flip, 3: serve, 4: done
      orderId: null
    };

    // Spawn a single tutorial order and pause normal spawning
    this.spawnTutorialOrder();

    // Lightweight order spawn loop only when tutorial not active
    this.time.addEvent({ delay: 1000, callback: () => { if (!this.tutorial.active) this.spawnOrder(); }, loop: true });

    // Update instruction immediately
    this.updateInstruction();

    // Small hint overlay rectangle
    this.hintBg = this.add.rectangle(WIDTH/2, 60, WIDTH-20, 52, 0xffffff).setStrokeStyle(2, 0xe6cda9).setAlpha(0.95);
    this.hintText = this.add.text(WIDTH/2, 60, '', { font:'14px Arial', fill:'#222', align:'center', wordWrap:{width:WIDTH-40} }).setOrigin(0.5);

    // Allow audio after first user gesture
    this.input.once('pointerdown', () => { this.playBeep(880, 0.02, 0.02); });
  }

  createStations() {
    // Batter station (left)
    this.batterZone = this.add.rectangle(60, HEIGHT/2, 100, 120, 0xfff2d6).setStrokeStyle(2, 0xcaa46b).setInteractive();
    this.add.text(60, HEIGHT/2-60, 'Batter', {font:'14px Arial', fill:'#333'}).setOrigin(0.5);

    // Skillet (center)
    this.skillet = this.add.rectangle(WIDTH/2, HEIGHT/2, 160 * this.upgrades.skilletSize, 120 * this.upgrades.skilletSize, 0x8b5a2b).setStrokeStyle(3, 0x553316).setInteractive();
    this.skilletState = { batter:0, spread:0, flipped:false, ready:false };
    this.skilletText = this.add.text(WIDTH/2, HEIGHT/2, 'Skillet', {font:'14px Arial', fill:'#fff'}).setOrigin(0.5);

    // Plate (right)
    this.plateZone = this.add.rectangle(WIDTH-60, HEIGHT/2, 100, 120, 0xfff7ea).setStrokeStyle(2, 0xcaa46b).setInteractive();
    this.add.text(WIDTH-60, HEIGHT/2-60, 'Plate', {font:'14px Arial', fill:'#333'}).setOrigin(0.5);

    // Visual for batter fill & spread meter
    this.batterMeter = this.add.rectangle(WIDTH/2 -70, HEIGHT/2+70, 0, 8, 0xffdf9a).setOrigin(0,0.5);
    this.spreadMeter = this.add.rectangle(WIDTH/2 -70, HEIGHT/2+90, 0, 8, 0xa1c96a).setOrigin(0,0.5);
  }

  createUpgrades() {
    const baseY = 500;
    this.add.text(10, baseY-24, 'Upgrades (coins)', {font:'14px Arial', fill:'#222'});

    this.pourBtn = this.add.text(10, baseY, `Faster Pour (+) 20`, { font:'12px Arial', fill:'#0066cc', backgroundColor:'#fff' }).setInteractive();
    this.pourBtn.on('pointerdown', () => this.buyUpgrade('pourSpeed', 20));

    this.skilletBtn = this.add.text(10, baseY+28, `Bigger Skillet (+) 40`, { font:'12px Arial', fill:'#0066cc', backgroundColor:'#fff' }).setInteractive();
    this.skilletBtn.on('pointerdown', () => this.buyUpgrade('skilletSize', 40));

    this.garnishBtn = this.add.text(10, baseY+56, `Faster Garnish (+) 30`, { font:'12px Arial', fill:'#0066cc', backgroundColor:'#fff' }).setInteractive();
    this.garnishBtn.on('pointerdown', () => this.buyUpgrade('garnishSpeed', 30));
  }

  buyUpgrade(key, cost) {
    if (this.currency >= cost) {
      this.currency -= cost;
      this.upgrades[key] = parseFloat((this.upgrades[key] + 0.2).toFixed(2));
      localStorage.setItem('dosa_currency', String(this.currency));
      localStorage.setItem('dosa_upgrades', JSON.stringify(this.upgrades));
      this.scoreText.setText(`Coins: ${this.currency}`);
      // Apply skillet change live
      if (key === 'skilletSize') {
        this.skillet.setSize(160 * this.upgrades.skilletSize, 120 * this.upgrades.skilletSize);
      }
      this.playBeep(660,0.06,0.04);
    } else {
      this.flashText('Not enough coins');
    }
  }

  flashText(msg) {
    const t = this.add.text(WIDTH/2, 40, msg, { font:'14px Arial', fill:'#b00' }).setOrigin(0.5);
    this.tweens.add({ targets:t, alpha:0, delay:800, duration:600, onComplete:()=>t.destroy() });
  }

  spawnTutorialOrder() {
    this.orders = [];
    const type = 'Plain';
    const value = 10;
    const order = { id:Date.now(), type, value, time:60000, timer:0 };
    this.orders.push(order);
    this.tutorial.orderId = order.id;
    this.drawOrders();
    // show explanation
    this.showHint('Welcome to Dosa Dash! Let\'s make a dosa. Tap the BATTER station to pour.');
    this.updateInstruction();
  }

  spawnOrder() {
    // If too many orders skip
    if (this.orders.length >= 3) return;
    const types = ['Plain', 'Masala', 'Rava'];
    const type = Phaser.Utils.Array.GetRandom(types);
    const value = type === 'Plain' ? 10 : (type==='Masala'?15:20);
    const order = { id:Date.now(), type, value, time:60000, timer:0 };
    this.orders.push(order);
    this.drawOrders();
  }

  drawOrders() {
    if (this.orderGroup) this.orderGroup.destroy(true);
    this.orderGroup = this.add.group();
    for (let i=0;i<this.orders.length;i++){
      const o = this.orders[i];
      const x = WIDTH/2; const y = 80 + i*44;
      const bg = this.add.rectangle(x,y,300,36,0xffffff).setStrokeStyle(2,0xe6cda9);
      const txt = this.add.text(60,y, `${o.type} Dosa`, {font:'14px Arial', fill:'#222'}).setOrigin(0,0.5);
      const t2 = this.add.text(260,y, `${Math.max(0,Math.ceil((o.time - o.timer)/1000))}s`, {font:'12px Arial', fill:'#222'}).setOrigin(1,0.5);
      this.orderGroup.addMultiple([bg,txt,t2]);
    }
  }

  pointerDown(pointer) {
    if (this.batterZone.getBounds().contains(pointer.x, pointer.y)) {
      // pour
      this.pouring = true;
      this.pourStart = this.time.now;
      this.playBeep(880,0.03,0.02);
    }

    if (this.skillet.getBounds().contains(pointer.x, pointer.y)) {
      // maybe flip if spread done
      if (this.skilletState.spread >= 1 && !this.skilletState.flipped) {
        this.skilletState.flipped = true;
        this.skilletState.ready = true;
        this.flashText('Flipped!');
        this.playBeep(880,0.06,0.04);
        this.emitParticles(this.skillet.x, this.skillet.y);
        // Tutorial step progress
        if (this.tutorial.active && this.tutorial.step === 2) {
          this.tutorial.step = 3; // move to serve
          this.showHint('Great! Now tap the PLATE to serve the dosa.');
          this.updateInstruction();
        }
      }
    }

    if (this.plateZone.getBounds().contains(pointer.x, pointer.y)) {
      // Serve if ready
      if (this.skilletState.ready) {
        this.serveDosa();
      } else {
        this.flashText('Not ready');
        this.playBeep(220,0.05,0.02);
      }
    }
  }

  pointerMove(pointer) {
    if (this.pouring) {
      // increase batter in skillet based on time and upgrade
      const elapsed = (this.time.now - this.pourStart);
      const speed = 0.002 * this.upgrades.pourSpeed; // per ms
      this.skilletState.batter = Math.min(1, this.skilletState.batter + elapsed * speed);
      this.pourStart = this.time.now;
      // update batter meter
      this.batterMeter.width = 140 * this.skilletState.batter;

      // tutorial progression: if poured enough, move to spread
      if (this.tutorial.active && this.tutorial.step === 0 && this.skilletState.batter >= 0.35) {
        this.tutorial.step = 1;
        this.showHint('Nice pour! Now drag across the skillet to SPREAD the batter evenly.');
        this.updateInstruction();
      }
    }

    // If dragging across skillet, increase spread
    if (pointer.isDown && this.skillet.getBounds().contains(pointer.x, pointer.y)) {
      // heuristic: pointer movement increases spread
      this.skilletState.spread = Math.min(1, this.skilletState.spread + 0.01 * this.upgrades.skilletSize);
      this.spreadMeter.width = 140 * this.skilletState.spread;
      // tutorial progression
      if (this.tutorial.active && this.tutorial.step === 1 && this.skilletState.spread >= 0.45) {
        this.tutorial.step = 2;
        this.showHint('Good spread! Tap the skillet to FLIP the dosa when ready.');
        this.updateInstruction();
      }
    }
  }

  pointerUp(pointer) {
    if (this.pouring) {
      this.pouring = false;
    }
  }

  serveDosa() {
    // fulfill first order if any
    if (this.orders.length === 0) { this.flashText('No orders'); return; }
    const order = this.orders.shift();
    const tip = order.value + Math.round( (this.skilletState.spread + (this.skilletState.flipped?0.5:0)) * 10 );
    this.currency += tip;
    this.servedCount += 1;
    localStorage.setItem('dosa_currency', String(this.currency));
    localStorage.setItem('dosa_upgrades', JSON.stringify(this.upgrades));
    this.scoreText.setText(`Coins: ${this.currency}`);
    this.streakText.setText(`Served: ${this.servedCount}`);
    this.skilletState = { batter:0, spread:0, flipped:false, ready:false };
    this.batterMeter.width = 0; this.spreadMeter.width = 0;
    this.drawOrders();
    this.flashText(`+${tip} coins`);
    this.playBeep(1000,0.06,0.05);
    this.emitParticles(this.skillet.x, this.skillet.y);

    // If tutorial active, complete it
    if (this.tutorial.active && this.tutorial.step === 3) {
      this.tutorial.step = 4;
      this.tutorial.active = false;
      this.showHint('Tutorial complete! You earned coins. Play more to unlock upgrades.');
      this.updateInstruction();
      // small reward
      this.currency += 10;
      localStorage.setItem('dosa_currency', String(this.currency));
      this.scoreText.setText(`Coins: ${this.currency}`);
    }
  }

  emitParticles(x,y) {
    const emitter = this.particles.createEmitter({ x, y, speed: { min: 50, max: 120 }, angle: { min: 0, max: 360 }, lifespan: 600, quantity: 6, scale: { start: 0.8, end: 0.2 } });
    this.time.delayedCall(400, () => emitter.stop());
  }

  updateInstruction() {
    if (this.tutorial.active) {
      switch(this.tutorial.step) {
        case 0: this.instruction.setText('Step: Pour batter (Tap left)'); break;
        case 1: this.instruction.setText('Step: Spread batter (Drag on skillet)'); break;
        case 2: this.instruction.setText('Step: Flip (Tap skillet)'); break;
        case 3: this.instruction.setText('Step: Serve (Tap plate)'); break;
        default: this.instruction.setText('Tutorial finished');
      }
    } else {
      this.instruction.setText('Tap batter → Swipe to spread → Tap to flip → Tap plate to serve');
      this.hintBg.setVisible(false);
      this.hintText.setVisible(false);
    }
  }

  showHint(text) {
    this.hintText.setText(text);
    this.hintBg.setVisible(true);
    this.hintText.setVisible(true);
    this.playBeep(1200,0.04,0.03);
  }

  update(time, delta) {
    // countdown orders
    for (let i = this.orders.length-1; i>=0; i--) {
      const o = this.orders[i];
      o.timer += delta;
      if (o.timer >= o.time) {
        // order expired
        this.orders.splice(i,1);
        this.flashText('Order expired');
      }
    }
    this.drawOrders();
  }
}

const config = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'gameContainer',
  scene: [DosaGame],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
};

const game = new Phaser.Game(config);
