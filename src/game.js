// src/game.js
import Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js';

const WIDTH = 360;
const HEIGHT = 640;

class DosaGame extends Phaser.Scene {
  constructor() {
    super('DosaDash');
  }

  preload() {
    // No external assets used — graphics drawn procedurally for zero-cost prototype
  }

  create() {
    // Simple state
    this.currency = parseInt(localStorage.getItem('dosa_currency') || '0');
    this.upgrades = JSON.parse(localStorage.getItem('dosa_upgrades') || JSON.stringify({pourSpeed:1,skilletSize:1,garnishSpeed:1}));

    // Background
    this.cameras.main.setBackgroundColor(0xf7e9d9);

    // Draw counter and stations
    this.createStations();

    // Orders
    this.orders = [];
    this.spawnOrderTimer = 0;
    this.spawnInterval = 3000; // ms

    // Current active order
    this.currentOrder = null;

    // Score & UI
    this.scoreText = this.add.text(10, 10, `Coins: ${this.currency}`, { font: '16px Arial', fill:'#222' });
    this.streakText = this.add.text(10, 30, `Served: 0`, { font: '12px Arial', fill:'#222' });
    this.servedCount = 0;

    // Instruction text
    this.instruction = this.add.text(WIDTH/2, HEIGHT-30, 'Tap batter → Swipe to spread → Tap to flip → Tap plate to serve', { font:'12px Arial', fill:'#333' }).setOrigin(0.5);

    // Upgrade buttons
    this.createUpgrades();

    // Input handlers
    this.input.on('pointerdown', (p) => { this.pointerDown(p); });
    this.input.on('pointerup', (p) => { this.pointerUp(p); });
    this.input.on('pointermove', (p) => { this.pointerMove(p); });

    // Simple order spawn
    this.time.addEvent({ delay: 1000, callback: () => this.spawnOrder(), loop: true });
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
    this.batterMeter = this.add.rectangle(WIDTH/2, HEIGHT/2+70, 0, 8, 0xffdf9a).setOrigin(0.5,0.5);
    this.spreadMeter = this.add.rectangle(WIDTH/2, HEIGHT/2+90, 0, 8, 0xa1c96a).setOrigin(0.5,0.5);
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
    } else {
      this.flashText('Not enough coins');
    }
  }

  flashText(msg) {
    const t = this.add.text(WIDTH/2, 40, msg, { font:'14px Arial', fill:'#b00' }).setOrigin(0.5);
    this.tweens.add({ targets:t, alpha:0, delay:800, duration:600, onComplete:()=>t.destroy() });
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
    }

    if (this.skillet.getBounds().contains(pointer.x, pointer.y)) {
      // maybe flip if spread done
      if (this.skilletState.spread >= 1 && !this.skilletState.flipped) {
        // Flip success if within timing
        this.skilletState.flipped = true;
        this.skilletState.ready = true;
        this.flashText('Flipped!');
      }
    }

    if (this.plateZone.getBounds().contains(pointer.x, pointer.y)) {
      // Serve if ready
      if (this.skilletState.ready) {
        this.serveDosa();
      } else {
        this.flashText('Not ready');
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
      this.batterMeter.x = WIDTH/2 - 70 + this.batterMeter.width/2;
      // spread meter proportional to batter
      this.spreadMeter.width = 140 * this.skilletState.spread;
      this.spreadMeter.x = WIDTH/2 - 70 + this.spreadMeter.width/2;
    }

    // If dragging across skillet, increase spread
    if (pointer.isDown && this.skillet.getBounds().contains(pointer.x, pointer.y)) {
      // heuristic: pointer movement increases spread
      this.skilletState.spread = Math.min(1, this.skilletState.spread + 0.01 * this.upgrades.skilletSize);
      this.spreadMeter.width = 140 * this.skilletState.spread;
      this.spreadMeter.x = WIDTH/2 - 70 + this.spreadMeter.width/2;
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
    this.scoreText.setText(`Coins: ${this.currency}`);
    this.streakText.setText(`Served: ${this.servedCount}`);
    this.skilletState = { batter:0, spread:0, flipped:false, ready:false };
    this.batterMeter.width = 0; this.spreadMeter.width = 0;
    this.drawOrders();
    this.flashText(`+${tip} coins`);
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

export default game;
