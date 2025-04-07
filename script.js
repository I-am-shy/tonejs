// 音高数字到字母的映射
const pitchMap = {
  1: 'C',
  2: 'D',
  3: 'E',
  4: 'F',
  5: 'G',
  6: 'A',
  7: 'B',
  8: 'C',
  9: 'D'
};

// 调式数字到字母的映射
const keyMap = {
  1: 'C',
  2: 'G',
  3: 'D',
  4: 'A',
  5: 'E',
  6: 'B',
  7: 'F#',
  8: 'Db',
  9: 'Ab',
  10: 'Eb',
  11: 'Bb',
  12: 'F'
};

// 全局变量
let currentSynth;
let isPlaying = false;
let startTime = 0;
let totalDuration = 0;
let progressInterval;
let recorder; // 添加录音机变量
let savedInstruments = {};

// 全局变量 - 添加自定义参数对象
let customSynthParams = {
  synthType: 'Synth',
  oscillator: {
    type: 'sine'
  },
  envelope: {
    attack: 0.01,
    decay: 0.5,
    sustain: 0.3,
    release: 1.0
  },
  modulation: {
    type: 'sine'
  },
  modulationEnvelope: {
    attack: 0.5,
    decay: 0.5,
    sustain: 0.3,
    release: 0.5
  },
  harmonicity: 1.0,
  modulationIndex: 5,
  effects: {
    eq: {
      low: 0,
      mid: 0,
      high: 0
    },
    reverb: {
      decay: 1.2,
      wet: 0.15
    }
  }
};

// 添加一个全局函数来确保音频上下文已启动
function ensureAudioContext() {
  return new Promise((resolve) => {
    if (Tone.context.state === 'running') {
      resolve();
      return;
    }
    
    // 尝试启动音频上下文
    Tone.start().then(() => {
      console.log('AudioContext 已启动');
      resolve();
    }).catch(err => {
      console.error('启动 AudioContext 失败:', err);
      
      // 显示提示
      const audioStartPrompt = document.createElement('div');
      audioStartPrompt.className = 'fixed top-0 left-0 w-full bg-yellow-100 text-yellow-800 p-3 text-center z-50';
      audioStartPrompt.innerHTML = '请点击此处启动音频引擎 <i class="fas fa-volume-up ml-1"></i>';
      document.body.prepend(audioStartPrompt);
      
      // 点击提示启动音频上下文
      audioStartPrompt.addEventListener('click', function() {
        Tone.start().then(() => {
          console.log('AudioContext 已启动');
          this.remove();
          resolve();
        });
      });
    });
  });
}

// 新的乐谱解析函数
function parseSimpleScore(score) {
  const lines = score.trim().split('\n');
  
  // 提取基本设置（如果有）
  let bpm = 120; // 默认BPM
  let startLine = 0;
  
  if (lines[0].startsWith('BPM:')) {
    bpm = parseInt(lines[0].split(':')[1].trim(), 10);
    startLine = 1;
  }
  
  // 解析音符
  const notes = [];
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    
    const noteTokens = line.split(/\s+/);
    noteTokens.forEach(token => {
      if (token === '') return;
      
      // 检查是否是和弦（包含反斜杠）
      if (token.includes('\\')) {
        // 解析和弦中的每个音符
        const chordNotes = token.split('\\');
        const chord = [];
        
        // 获取和弦中最长的持续时间，作为和弦的总持续时间
        let maxDuration = 0;
        
        chordNotes.forEach(noteStr => {
          // 解析格式: 音高-时长
          const [pitch, duration] = noteStr.split('-');
          
          // 处理音高
          let noteValue;
          let octave = 4; // 默认中央C所在八度
          
          if (pitch === '0') {
            // 休止符在和弦中没有意义，跳过
            return;
          } else {
            // 处理升降号和音高
            let basePitch = pitch;
            if (pitch.startsWith('·')) {
              // 升高八度
              octave += 1;
              basePitch = pitch.substring(1);
            } else if (pitch.startsWith('~')) {
              // 降低八度
              octave -= 1;
              basePitch = pitch.substring(1);
            }
            
            // 将数字音高转换为字母音高
            const pitchNumber = parseInt(basePitch, 10);
            const pitchLetter = pitchMap[pitchNumber];
            
            if (!pitchLetter) {
              console.error(`未识别的音高: ${pitch}`);
              return;
            }
            
            noteValue = `${pitchLetter}${octave}`;
          }
          
          // 处理时长（单位为基本时间单位的倍数）
          const durationValue = parseFloat(duration);
          
          // 更新最大持续时间
          maxDuration = Math.max(maxDuration, durationValue);
          
          // 添加到和弦中
          chord.push({
            note: noteValue,
            duration: durationValue
          });
        });
        
        // 将和弦添加到音符列表
        if (chord.length > 0) {
          notes.push({
            type: 'chord',
            notes: chord,
            duration: maxDuration
          });
        }
      } else {
        // 单个音符的处理（现有代码）
        const [pitch, duration] = token.split('-');
        
        // 处理音高
        let noteValue;
        let octave = 4; // 默认中央C所在八度
        
        if (pitch === '0') {
          // 休止符
          noteValue = 'rest';
        } else {
          // 处理升降号和音高
          let basePitch = pitch;
          if (pitch.startsWith('·')) {
            // 升高八度
            octave += 1;
            basePitch = pitch.substring(1);
          } else if (pitch.startsWith('~')) {
            // 降低八度
            octave -= 1;
            basePitch = pitch.substring(1);
          }
          
          // 将数字音高转换为字母音高
          const pitchNumber = parseInt(basePitch, 10);
          const pitchLetter = pitchMap[pitchNumber];
          
          if (!pitchLetter) {
            console.error(`未识别的音高: ${pitch}`);
            return;
          }
          
          noteValue = `${pitchLetter}${octave}`;
        }
        
        // 处理时长（单位为基本时间单位的倍数）
        const durationValue = parseFloat(duration);
        
        notes.push({
          type: 'note',
          note: noteValue,
          duration: durationValue
        });
      }
    });
  }
  
  return { bpm, notes };
}

// 格式化时间为 MM:SS 格式
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 更新进度条和时间显示
function updateProgress() {
  if (!isPlaying) return;
  
  const currentTime = Tone.now() - startTime;
  const progress = (currentTime / totalDuration) * 100;
  
  document.getElementById('current-time').textContent = formatTime(currentTime);
  document.getElementById('progress-bar').style.width = `${Math.min(progress, 100)}%`;
  
  if (currentTime >= totalDuration) {
    stopPlayback();
  }
}

// 显示当前播放的音符
function displayNote(note) {
  const noteDisplay = document.getElementById('current-note');
  
  if (note === 'rest') {
    noteDisplay.textContent = '休止符';
    noteDisplay.className = 'text-4xl font-bold text-gray-400';
  } else {
    noteDisplay.textContent = note;
    noteDisplay.className = 'text-4xl font-bold text-blue-500 note-highlight';
  }
}

// 播放简化格式的乐谱
function playSimpleScore(score) {
  // 确保 Tone.js 已经启动
  if (Tone.context.state !== 'running') {
    ensureAudioContext().then(() => {
      // 递归调用自身，确保在上下文启动后执行
      playSimpleScore(score);
    });
    return; // 提前返回，等待上下文启动
  }
  
  // 停止之前的播放
  stopPlayback();
  
  // 显示加载中状态
  document.getElementById('current-note').textContent = '加载中...';
  document.getElementById('current-note').className = 'text-4xl font-bold text-yellow-500';
  
  // 解析乐谱
  const { bpm, notes } = parseSimpleScore(score);
  console.log(`BPM: ${bpm}, 音符数: ${notes.length}`);
  
  // 初始化合成器
  const instrumentType = document.getElementById('instrument').value;
  
  // 创建主混响效果（所有乐器共用）
  const mainReverb = new Tone.Reverb({
    decay: customSynthParams.effects.reverb.decay,
    wet: customSynthParams.effects.reverb.wet
  }).toDestination();
  
  // 使用纯合成器而非采样器，避免加载问题
  let synth;
  
  // 检查是否使用自定义参数
  const useCustomParams = !document.getElementById('params-panel').classList.contains('params-panel-hidden') || instrumentType === 'custom';
  
  if (useCustomParams) {
    // 使用自定义参数创建合成器
    switch (customSynthParams.synthType) {
      case 'Synth':
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: customSynthParams.oscillator.type
          },
          envelope: {
            attack: customSynthParams.envelope.attack,
            decay: customSynthParams.envelope.decay,
            sustain: customSynthParams.envelope.sustain,
            release: customSynthParams.envelope.release
          }
        });
        break;
        
      case 'AMSynth':
        synth = new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: customSynthParams.harmonicity,
          oscillator: {
            type: customSynthParams.oscillator.type
          },
          envelope: {
            attack: customSynthParams.envelope.attack,
            decay: customSynthParams.envelope.decay,
            sustain: customSynthParams.envelope.sustain,
            release: customSynthParams.envelope.release
          },
          modulation: {
            type: customSynthParams.modulation.type
          },
          modulationEnvelope: {
            attack: customSynthParams.modulationEnvelope.attack,
            decay: customSynthParams.modulationEnvelope.decay,
            sustain: customSynthParams.modulationEnvelope.sustain,
            release: customSynthParams.modulationEnvelope.release
          }
        });
        break;
        
      case 'FMSynth':
        synth = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: customSynthParams.harmonicity,
          modulationIndex: customSynthParams.modulationIndex,
          oscillator: {
            type: customSynthParams.oscillator.type
          },
          envelope: {
            attack: customSynthParams.envelope.attack,
            decay: customSynthParams.envelope.decay,
            sustain: customSynthParams.envelope.sustain,
            release: customSynthParams.envelope.release
          },
          modulation: {
            type: customSynthParams.modulation.type
          },
          modulationEnvelope: {
            attack: customSynthParams.modulationEnvelope.attack,
            decay: customSynthParams.modulationEnvelope.decay,
            sustain: customSynthParams.modulationEnvelope.sustain,
            release: customSynthParams.modulationEnvelope.release
          }
        });
        break;
        
      case 'PluckSynth':
        synth = new Tone.PolySynth(Tone.PluckSynth, {
          attackNoise: 1,
          dampening: 4000,
          resonance: 0.9,
          release: customSynthParams.envelope.release
        });
        break;
        
      case 'MetalSynth':
        synth = new Tone.PolySynth(Tone.MetalSynth, {
          frequency: 200,
          envelope: {
            attack: customSynthParams.envelope.attack,
            decay: customSynthParams.envelope.decay,
            release: customSynthParams.envelope.release
          },
          harmonicity: customSynthParams.harmonicity,
          modulationIndex: customSynthParams.modulationIndex,
          resonance: 4000,
          octaves: 1.5
        });
        break;
        
      default:
        synth = new Tone.PolySynth(Tone.Synth);
    }
    
    // 创建均衡器
    const customEQ = new Tone.EQ3({
      low: customSynthParams.effects.eq.low,
      mid: customSynthParams.effects.eq.mid,
      high: customSynthParams.effects.eq.high
    });
    
    // 连接效果链
    synth.connect(customEQ);
    customEQ.connect(mainReverb);
  } else {
    // 使用预设乐器
    switch (instrumentType) {
      case 'piano':
        // 钢琴音色 - 明亮清脆
        synth = new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2.5,
          oscillator: {
            type: "sine"
          },
          envelope: {
            attack: 0.01,
            decay: 2.0,
            sustain: 0.4,
            release: 2.0
          },
          modulation: {
            type: "square"
          },
          modulationEnvelope: {
            attack: 0.5,
            decay: 0.5,
            sustain: 0.3,
            release: 0.5
          },
          volume: 3
        });
        
        // 钢琴特有效果
        const pianoEQ = new Tone.EQ3({
          low: 2,
          mid: 2,
          high: 0
        });
        
        // 连接效果链
        synth.connect(pianoEQ);
        pianoEQ.connect(mainReverb);
        break;
        
      case 'guitar':
        // 吉他音色 - 温暖有质感
        synth = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 1.1,
          modulationIndex: 5,
          oscillator: {
            type: "triangle"
          },
          envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.3,
            release: 1.2
          },
          modulation: {
            type: "square"
          },
          modulationEnvelope: {
            attack: 0.5,
            decay: 0.1,
            sustain: 0.2,
            release: 0.5
          }
        });
        
        // 吉他特有效果
        const guitarEQ = new Tone.EQ3({
          low: 3,
          mid: 0,
          high: 1
        });
        
        // 连接效果链
        synth.connect(guitarEQ);
        guitarEQ.connect(mainReverb);
        break;
        
      // 其他乐器保持不变...
      case 'guzheng':
        // 古筝音色
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "triangle",
            partials: [1, 0.3, 0.1, 0.05]
          },
          envelope: {
            attack: 0.001,
            decay: 1.5,
            sustain: 0.1,
            release: 2.0
          }
        });
        
        // 古筝特有效果
        const guzhengFilter = new Tone.Filter({
          type: "bandpass",
          frequency: 1000,
          Q: 1
        });
        
        const guzhengEQ = new Tone.EQ3({
          low: 0,
          mid: 0,
          high: 6
        });
        
        // 连接效果链
        synth.connect(guzhengFilter);
        guzhengFilter.connect(guzhengEQ);
        guzhengEQ.connect(mainReverb);
        break;
        
      case 'flute':
        // 长笛音色
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "sine"
          },
          envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.8,
            release: 0.8
          }
        });
        
        // 长笛特有效果
        const fluteFilter = new Tone.Filter({
          type: "bandpass",
          frequency: 700,
          Q: 0.8
        });
        
        // 连接效果链
        synth.connect(fluteFilter);
        fluteFilter.connect(mainReverb);
        break;
        
      case 'violin':
        // 小提琴音色
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "sawtooth"
          },
          envelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.7,
            release: 1.0
          }
        });
        
        // 小提琴特有效果
        const violinFilter = new Tone.Filter({
          type: "highpass",
          frequency: 300,
          Q: 0.5
        });
        
        // 添加颤音效果
        const violinVibrato = new Tone.Vibrato({
          frequency: 5,
          depth: 0.1,
          wet: 0.5
        });
        
        // 连接效果链
        synth.connect(violinFilter);
        violinFilter.connect(violinVibrato);
        violinVibrato.connect(mainReverb);
        break;
        
      case 'xylophone':
        // 木琴音色
        synth = new Tone.PolySynth(Tone.MetalSynth, {
          frequency: 200,
          envelope: {
            attack: 0.001,
            decay: 0.5,
            release: 0.1
          },
          harmonicity: 3.1,
          modulationIndex: 16,
          resonance: 4000,
          octaves: 1.5
        });
        
        // 木琴特有效果
        const xylophoneEQ = new Tone.EQ3({
          low: -6,
          mid: 0,
          high: 6
        });
        
        // 连接效果链
        synth.connect(xylophoneEQ);
        xylophoneEQ.connect(mainReverb);
        break;
        
      default:
        synth = new Tone.PolySynth(Tone.Synth).connect(mainReverb);
    }
  }
  
  // 设置音量
  const volume = parseFloat(document.getElementById('volume').value);
  synth.volume.value = Tone.gainToDb(volume);
  
  // 如果有之前的合成器，释放它
  if (currentSynth) {
    currentSynth.dispose();
  }
  
  // 保存当前合成器
  currentSynth = synth;
  
  // 设置 BPM
  Tone.Transport.bpm.value = bpm;
  
  // 重置 Transport
  Tone.Transport.cancel();
  Tone.Transport.stop();
  
  // 安排音符播放
  scheduleSimpleNotes(notes);
}

// 安排简化格式的音符播放
function scheduleSimpleNotes(notes) {
  let timeOffset = 0;
  totalDuration = 0;
  
  // 基本时间单位（秒）
  const baseTimeUnit = 0.25; // 1/4秒为基本单位
  
  // 安排所有音符的播放
  notes.forEach((noteItem) => {
    if (noteItem.type === 'chord') {
      // 处理和弦
      const chordDuration = noteItem.duration * baseTimeUnit;
      
      // 显示和弦信息
      Tone.Transport.schedule((time) => {
        displayChord(noteItem.notes.map(n => n.note));
      }, timeOffset);
      
      // 安排和弦中每个音符的播放
      noteItem.notes.forEach((chordNote) => {
        const noteDuration = chordNote.duration * baseTimeUnit;
        
        Tone.Transport.schedule((time) => {
          try {
            // 使用略短的演奏时间，避免音符重叠
            currentSynth.triggerAttackRelease(chordNote.note, noteDuration * 0.95, time);
          } catch (error) {
            console.error(`播放音符 ${chordNote.note} 时出错:`, error);
          }
        }, timeOffset);
      });
      
      // 更新时间偏移和总时长
      timeOffset += chordDuration;
      totalDuration += chordDuration;
    } else {
      // 处理单个音符（现有代码）
      const durationSeconds = noteItem.duration * baseTimeUnit;
      
      if (noteItem.note === 'rest') {
        // 休止符
        Tone.Transport.schedule((time) => {
          displayNote('rest');
        }, timeOffset);
      } else {
        Tone.Transport.schedule((time) => {
          try {
            // 使用略短的演奏时间，避免音符重叠
            currentSynth.triggerAttackRelease(noteItem.note, durationSeconds * 0.95, time);
            displayNote(noteItem.note);
          } catch (error) {
            console.error(`播放音符 ${noteItem.note} 时出错:`, error);
          }
        }, timeOffset);
      }
      
      // 更新时间偏移和总时长
      timeOffset += durationSeconds;
      totalDuration += durationSeconds;
    }
  });
  
  // 设置总时长显示
  document.getElementById('total-time').textContent = formatTime(totalDuration);
  
  // 启动播放
  startTime = Tone.now();
  Tone.Transport.start();
  isPlaying = true;
  
  // 更新UI状态
  document.getElementById('play').classList.add('bg-green-500');
  document.getElementById('play').classList.remove('bg-blue-500');
  document.getElementById('play').innerHTML = '<i class="fas fa-music mr-2"></i> 播放中';
  
  // 启动进度更新
  progressInterval = setInterval(updateProgress, 100);
}

// 暂停播放
function pausePlayback() {
  Tone.Transport.pause();
  isPlaying = false;
  clearInterval(progressInterval);
  
  // 更新UI状态
  document.getElementById('play').classList.remove('bg-green-500');
  document.getElementById('play').classList.add('bg-blue-500');
  document.getElementById('play').innerHTML = '<i class="fas fa-play mr-2"></i> 继续';
}

// 停止播放
function stopPlayback() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  isPlaying = false;
  clearInterval(progressInterval);
  
  // 重置UI
  document.getElementById('current-time').textContent = '00:00';
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('current-note').textContent = '-';
  document.getElementById('current-note').className = 'text-4xl font-bold text-blue-500';
  
  document.getElementById('play').classList.remove('bg-green-500');
  document.getElementById('play').classList.add('bg-blue-500');
  document.getElementById('play').innerHTML = '<i class="fas fa-play mr-2"></i> 播放';
}

// 初始化录音机
function initRecorder() {
  // 创建录音机
  recorder = new Tone.Recorder();
  
  // 将主输出连接到录音机
  Tone.getDestination().connect(recorder);
  
  console.log("录音机初始化完成，类型:", typeof recorder, "方法:", Object.keys(recorder));
}

// 静默生成音频文件，添加按钮上的环形进度动画
async function saveAsMP3() {
  if (isPlaying) {
    alert('请先停止播放再保存');
    return;
  }
  
  // 获取保存按钮
  const saveButton = document.getElementById('save');
  const originalText = saveButton.innerHTML;
  
  // 创建环形进度动画
  saveButton.innerHTML = `
    <div class="relative inline-flex items-center justify-center">
      <svg class="w-6 h-6" viewBox="0 0 24 24">
        <circle class="text-gray-300" stroke-width="2" stroke="currentColor" fill="transparent" r="10" cx="12" cy="12"></circle>
        <circle id="save-progress-circle" class="text-white" stroke-width="2" stroke="currentColor" fill="transparent" r="10" cx="12" cy="12" 
          stroke-dasharray="62.8" stroke-dashoffset="62.8" transform="rotate(-90 12 12)"></circle>
      </svg>
      <span class="ml-2">生成中...</span>
    </div>
  `;
  saveButton.disabled = true;
  
  // 获取进度圆环
  const progressCircle = document.getElementById('save-progress-circle');
  const circumference = 2 * Math.PI * 10; // 圆周长 = 2πr
  
  // 更新进度的函数
  const updateProgress = (percent) => {
    const offset = circumference - (percent / 100) * circumference;
    progressCircle.style.strokeDashoffset = offset;
  };
  
  // 初始化进度为0
  progressCircle.style.strokeDasharray = circumference;
  progressCircle.style.strokeDashoffset = circumference;
  
  try {
    // 确保 Tone.js 已经启动
    await Tone.start();
    console.log("Tone.js 已启动");
    updateProgress(5);
    
    // 解析乐谱
    const { bpm, notes } = parseSimpleScore(document.getElementById('score').value);
    updateProgress(10);
    
    // 计算总时长
    let totalTime = 0;
    const baseTimeUnit = 0.25;
    notes.forEach(({ duration }) => {
      totalTime += duration * baseTimeUnit;
    });
    updateProgress(15);
    
    // 创建离线上下文
    console.log("创建离线上下文...");
    const offlineContext = new Tone.OfflineContext(2, (totalTime + 1), 44100);
    Tone.setContext(offlineContext);
    updateProgress(20);
    
    // 在离线上下文中创建合成器
    console.log("创建合成器...");
    const instrumentType = document.getElementById('instrument').value;
    let synth;
    
    switch (instrumentType) {
      case 'piano':
        synth = new Tone.PolySynth(Tone.AMSynth, {
          harmonicity: 2,
          oscillator: { type: "triangle" },
          envelope: {
            attack: 0.005,
            decay: 0.3,
            sustain: 0.1,
            release: 0.4
          },
          modulation: { type: "square" },
          modulationEnvelope: {
            attack: 0.001,
            decay: 0.5,
            sustain: 0.2,
            release: 0.1
          }
        }).toDestination();
        break;
      case 'guitar':
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "sine"
          },
          envelope: {
            attack: 0.002,
            decay: 0.2,
            sustain: 0.1,
            release: 0.2
          }
        }).toDestination();
        break;
      case 'guzheng':
        synth = new Tone.PluckSynth({
          attackNoise: 1,
          dampening: 4000,
          resonance: 0.98
        }).toDestination();
        break;
      case 'flute':
        synth = new Tone.AMSynth({
          harmonicity: 2,
          oscillator: {
            type: "sine"
          },
          envelope: {
            attack: 0.05,
            decay: 0.1,
            sustain: 0.3,
            release: 0.3
          },
          modulation: {
            type: "square"
          },
          modulationEnvelope: {
            attack: 0.2,
            decay: 0,
            sustain: 0.5,
            release: 0.2
          }
        }).toDestination();
        break;
      case 'violin':
        synth = new Tone.FMSynth({
          harmonicity: 3.5,
          modulationIndex: 5,
          oscillator: {
            type: "triangle"
          },
          envelope: {
            attack: 0.05,
            decay: 0.1,
            sustain: 0.3,
            release: 0.4
          },
          modulation: {
            type: "sine"
          },
          modulationEnvelope: {
            attack: 0.3,
            decay: 0.1,
            sustain: 0.5,
            release: 0.2
          }
        }).toDestination();
        break;
      case 'xylophone':
        synth = new Tone.MetalSynth({
          frequency: 200,
          envelope: {
            attack: 0.001,
            decay: 0.4,
            release: 0.2
          },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5
        }).toDestination();
        break;
      default:
        synth = new Tone.PolySynth(Tone.Synth).toDestination();
    }
    
    // 设置音量
    const volume = parseFloat(document.getElementById('volume').value);
    synth.volume.value = Tone.gainToDb(volume);
    updateProgress(30);
    
    // 在离线上下文中安排音符
    console.log("安排音符...");
    let now = 0;
    notes.forEach(({ note, duration }, index) => {
      const durationSeconds = duration * baseTimeUnit;
      if (note !== 'rest') {
        synth.triggerAttackRelease(note, durationSeconds * 0.95, now);
      }
      now += durationSeconds;
      
      // 每安排10%的音符更新一次进度
      if (index % Math.ceil(notes.length / 10) === 0) {
        const arrangeProgress = 30 + Math.min(20 * (index / notes.length), 20);
        updateProgress(arrangeProgress);
      }
    });
    updateProgress(50);
    
    // 渲染音频
    console.log("渲染音频...");
    // 使用Promise和requestAnimationFrame来更新渲染进度
    const renderPromise = new Promise((resolve) => {
      let lastUpdateTime = performance.now();
      
      // 开始渲染
      const renderStartTime = performance.now();
      const estimatedRenderTime = totalTime * 100; // 估计渲染时间（毫秒）
      
      function checkRenderProgress() {
        const currentTime = performance.now();
        const elapsedTime = currentTime - renderStartTime;
        const progress = Math.min(elapsedTime / estimatedRenderTime, 1);
        
        // 只有经过一定时间才更新进度，避免过于频繁的更新
        if (currentTime - lastUpdateTime > 100) {
          updateProgress(50 + progress * 20);
          lastUpdateTime = currentTime;
        }
        
        if (progress < 1) {
          requestAnimationFrame(checkRenderProgress);
        }
      }
      
      requestAnimationFrame(checkRenderProgress);
      
      offlineContext.render().then(buffer => {
        updateProgress(70);
        resolve(buffer);
      });
    });
    
    const buffer = await renderPromise;
    console.log("音频渲染完成");
    updateProgress(75);
    
    // 将 AudioBuffer 转换为 WAV 格式
    console.log("转换为 WAV 格式...");
    const wavBlob = audioBufferToWav(buffer);
    updateProgress(85);
    
    // 创建下载链接
    console.log("创建下载链接...");
    const url = URL.createObjectURL(wavBlob);
    const anchor = document.createElement('a');
    anchor.download = '数字谱演奏_' + new Date().toISOString().slice(0, 10) + '.wav';
    anchor.href = url;
    updateProgress(95);
    
    // 触发下载
    anchor.click();
    
    // 清理
    URL.revokeObjectURL(url);
    updateProgress(100);
    
    // 恢复 Tone.js 上下文
    Tone.setContext(Tone.getContext());
    
    // 短暂显示100%进度后恢复按钮
    setTimeout(() => {
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
    }, 500);
    
    console.log("保存完成");
  } catch (error) {
    console.error('保存音频时出错:', error);
    alert('保存失败: ' + error.message);
    
    // 恢复 Tone.js 上下文
    Tone.setContext(Tone.getContext());
    
    // 恢复按钮状态
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}

// AudioBuffer 转 WAV 函数
function audioBufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const result = new Uint8Array(length);
  const view = new DataView(result.buffer);
  
  // RIFF chunk descriptor
  writeUTFBytes(view, 0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeUTFBytes(view, 8, 'WAVE');
  
  // FMT sub-chunk
  writeUTFBytes(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // 子块大小
  view.setUint16(20, 1, true); // PCM格式
  view.setUint16(22, numOfChan, true); // 通道数
  view.setUint32(24, buffer.sampleRate, true); // 采样率
  view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true); // 字节率
  view.setUint16(32, numOfChan * 2, true); // 块对齐
  view.setUint16(34, 16, true); // 位深度
  
  // 数据子块
  writeUTFBytes(view, 36, 'data');
  view.setUint32(40, length - 44, true);
  
  // 写入PCM样本
  const offset = 44;
  let pos = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numOfChan; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset + pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      pos += 2;
    }
  }
  
  return new Blob([result], { type: 'audio/wav' });
}

// 辅助函数：写入UTF8字符串
function writeUTFBytes(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// 事件监听器
document.addEventListener('DOMContentLoaded', () => {
  // 播放/暂停按钮
  document.getElementById('play').addEventListener('click', () => {
    ensureAudioContext().then(() => {
      if (!isPlaying) {
        // 如果当前没有播放，则开始播放
        // 检查是否是从头开始还是继续播放
        if (Tone.Transport.seconds > 0) {
          // 继续播放
          resumePlayback();
        } else {
          // 从头开始播放
          playSimpleScore(document.getElementById('score').value);
        }
      } else {
        // 如果当前正在播放，则暂停
        pausePlayback();
      }
    });
  });
  
  // 重置按钮
  document.getElementById('reset').addEventListener('click', () => {
    // 停止当前播放并重置进度
    stopPlayback();
  });
  
  // 音色选择
  document.getElementById('instrument').addEventListener('change', (e) => {
    // 如果正在播放，则更新音色
    if (isPlaying) {
      const volume = parseFloat(document.getElementById('volume').value);
      updateInstrument(e.target.value, volume);
    }
  });
  
  // 音量控制
  document.getElementById('volume').addEventListener('input', (e) => {
    if (currentSynth) {
      currentSynth.volume.value = Tone.gainToDb(parseFloat(e.target.value));
    }
  });
  
  // 保存MP3按钮
  document.getElementById('save').addEventListener('click', () => {
    saveAsMP3();
  });
  
  // 显示/隐藏参数面板
  document.getElementById('toggle-params').addEventListener('click', function() {
    const paramsPanel = document.getElementById('params-panel');
    
    if (paramsPanel.classList.contains('params-panel-hidden')) {
      // 显示面板
      paramsPanel.classList.remove('params-panel-hidden');
      paramsPanel.classList.add('params-panel-visible');
      this.innerHTML = '<i class="fas fa-sliders-h mr-1"></i> 隐藏参数';
      
      // 初始化参数
      initParamsFromCurrentInstrument();
    } else {
      // 隐藏面板
      paramsPanel.classList.remove('params-panel-visible');
      paramsPanel.classList.add('params-panel-hidden');
      this.innerHTML = '<i class="fas fa-sliders-h mr-1"></i> 显示参数';
    }
  });
  
  // 合成器类型变更
  document.getElementById('synth-type').addEventListener('change', function() {
    customSynthParams.synthType = this.value;
    
    // 根据合成器类型显示/隐藏相关参数
    const modulationParams = document.getElementById('modulation-params');
    const modulationIndexContainer = document.getElementById('modulation-index-container');
    
    if (this.value === 'AMSynth' || this.value === 'FMSynth') {
      modulationParams.style.display = 'block';
      
      if (this.value === 'FMSynth') {
        modulationIndexContainer.style.display = 'block';
      } else {
        modulationIndexContainer.style.display = 'none';
      }
    } else {
      modulationParams.style.display = 'none';
    }
  });
  
  // 波形类型变更
  document.getElementById('oscillator-type').addEventListener('change', function() {
    customSynthParams.oscillator.type = this.value;
  });
  
  // 调制波形类型变更
  document.getElementById('modulation-type').addEventListener('change', function() {
    customSynthParams.modulation.type = this.value;
  });
  
  // 包络参数变更
  document.getElementById('attack').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('attack-value').textContent = value.toFixed(3);
    customSynthParams.envelope.attack = value;
  });
  
  document.getElementById('decay').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('decay-value').textContent = value.toFixed(3);
    customSynthParams.envelope.decay = value;
  });
  
  document.getElementById('sustain').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('sustain-value').textContent = value.toFixed(2);
    customSynthParams.envelope.sustain = value;
  });
  
  document.getElementById('release').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('release-value').textContent = value.toFixed(3);
    customSynthParams.envelope.release = value;
  });
  
  // 调制参数变更
  document.getElementById('harmonicity').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('harmonicity-value').textContent = value.toFixed(1);
    customSynthParams.harmonicity = value;
  });
  
  document.getElementById('modulation-index').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('modulation-index-value').textContent = value.toFixed(1);
    customSynthParams.modulationIndex = value;
  });
  
  // 效果参数变更
  document.getElementById('eq-low').addEventListener('input', function() {
    const value = parseInt(this.value);
    document.getElementById('eq-low-value').textContent = value;
    customSynthParams.effects.eq.low = value;
  });
  
  document.getElementById('eq-mid').addEventListener('input', function() {
    const value = parseInt(this.value);
    document.getElementById('eq-mid-value').textContent = value;
    customSynthParams.effects.eq.mid = value;
  });
  
  document.getElementById('eq-high').addEventListener('input', function() {
    const value = parseInt(this.value);
    document.getElementById('eq-high-value').textContent = value;
    customSynthParams.effects.eq.high = value;
  });
  
  document.getElementById('reverb-decay').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('reverb-decay-value').textContent = value.toFixed(1);
    customSynthParams.effects.reverb.decay = value;
  });
  
  document.getElementById('reverb-wet').addEventListener('input', function() {
    const value = parseFloat(this.value);
    document.getElementById('reverb-wet-value').textContent = value.toFixed(2);
    customSynthParams.effects.reverb.wet = value;
  });
  
  // 应用参数按钮
  document.getElementById('apply-params').addEventListener('click', function() {
    ensureAudioContext().then(() => {
      // 应用当前参数
      playSimpleScore(document.getElementById('score').value);
    });
  });
  
  // 重置参数按钮
  document.getElementById('reset-params').addEventListener('click', function() {
    resetSynthParams();
    updateParamsUI();
  });
  
  // 乐器选择变更时
  document.getElementById('instrument').addEventListener('change', function() {
    if (this.value === 'custom') {
      // 显示自定义乐器面板
      document.getElementById('custom-instrument-panel').style.display = 'block';
      
      // 如果参数面板未显示，则显示它
      if (document.getElementById('params-panel').classList.contains('params-panel-hidden')) {
        document.getElementById('toggle-params').click();
      }
    } else {
      // 隐藏自定义乐器面板
      document.getElementById('custom-instrument-panel').style.display = 'none';
      
      // 应用当前乐器参数
      ensureAudioContext().then(() => {
        applyCurrentInstrumentParams();
      });
    }
  });
  
  // 初始化自定义乐器面板
  document.getElementById('custom-instrument-panel').style.display = 'none';
  
  // 加载保存的自定义乐器
  loadSavedInstruments();
  
  // 保存自定义乐器按钮
  document.getElementById('save-custom').addEventListener('click', function() {
    saveCustomInstrument();
  });
});

// 更新乐器音色函数
function updateInstrument(instrumentType, volume) {
  // 保存当前播放状态
  const wasPlaying = isPlaying;
  
  // 暂停当前播放
  if (wasPlaying) {
    Tone.Transport.pause();
  }
  
  // 停止当前合成器
  if (currentSynth) {
    currentSynth.releaseAll();
  }
  
  // 重新播放当前乐谱
  playSimpleScore(document.getElementById('score').value);
  
  // 如果之前在播放，则恢复播放位置
  if (wasPlaying) {
    // 获取当前播放位置
    const currentPosition = Tone.Transport.seconds;
    
    // 从当前位置继续播放
    Tone.Transport.start("+0.1", currentPosition);
    isPlaying = true;
    
    // 更新UI状态
    document.getElementById('play').classList.add('bg-green-500');
    document.getElementById('play').classList.remove('bg-blue-500');
    document.getElementById('play').innerHTML = '<i class="fas fa-music mr-2"></i> 播放中';
  }
}

// 添加一个新函数用于继续播放
function resumePlayback() {
  Tone.Transport.start();
  isPlaying = true;
  startTime = Tone.now() - Tone.Transport.seconds;
  progressInterval = setInterval(updateProgress, 100);
  
  // 更新UI状态
  document.getElementById('play').classList.add('bg-green-500');
  document.getElementById('play').classList.remove('bg-blue-500');
  document.getElementById('play').innerHTML = '<i class="fas fa-music mr-2"></i> 播放中';
}

// 添加显示和弦的函数
function displayChord(notes) {
  const noteDisplay = document.getElementById('current-note');
  
  // 将和弦中的音符连接起来显示
  const chordText = notes.join(' + ');
  noteDisplay.textContent = chordText;
  noteDisplay.className = 'text-4xl font-bold text-green-500 chord-highlight';
}

// 初始化参数从当前乐器
function initParamsFromCurrentInstrument() {
  const instrumentType = document.getElementById('instrument').value;
  
  switch (instrumentType) {
    case 'piano':
      // 钢琴音色 - 明亮清脆
      customSynthParams = {
        synthType: 'AMSynth',
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 2.0, sustain: 0.4, release: 2.0 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.5, decay: 0.5, sustain: 0.3, release: 0.5 },
        harmonicity: 2.5,
        modulationIndex: 0,
        effects: {
          eq: { low: 2, mid: 2, high: 0 },
          reverb: { decay: 1.2, wet: 0.15 }
        }
      };
      break;
      
    case 'guitar':
      // 吉他音色 - 温暖有质感
      customSynthParams = {
        synthType: 'FMSynth',
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 1.2 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.5, decay: 0.1, sustain: 0.2, release: 0.5 },
        harmonicity: 1.1,
        modulationIndex: 5,
        effects: {
          eq: { low: 3, mid: 0, high: 1 },
          reverb: { decay: 1.5, wet: 0.2 }
        }
      };
      break;
      
    case 'guzheng':
      // 古筝音色 - 明亮清脆，泛音丰富
      customSynthParams = {
        synthType: 'FMSynth',
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 1.5, sustain: 0.1, release: 2.0 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0.1, release: 0.5 },
        harmonicity: 3.5,
        modulationIndex: 10,
        effects: {
          eq: { low: -2, mid: 0, high: 6 },
          reverb: { decay: 2.0, wet: 0.25 }
        }
      };
      break;
      
    case 'flute':
      // 长笛音色 - 柔和通透
      customSynthParams = {
        synthType: 'FMSynth',
        oscillator: { type: 'sine' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.8 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.5, decay: 0.1, sustain: 0.7, release: 0.3 },
        harmonicity: 1.5,
        modulationIndex: 3,
        effects: {
          eq: { low: -3, mid: 2, high: 4 },
          reverb: { decay: 1.8, wet: 0.3 }
        }
      };
      break;
      
    case 'violin':
      // 小提琴音色 - 明亮有弦乐质感
      customSynthParams = {
        synthType: 'AMSynth',
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.7, release: 1.0 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 0.5 },
        harmonicity: 1.5,
        modulationIndex: 0,
        effects: {
          eq: { low: 0, mid: 3, high: 2 },
          reverb: { decay: 1.5, wet: 0.2 }
        }
      };
      break;
      
    case 'xylophone':
      // 木琴音色 - 短促明亮
      customSynthParams = {
        synthType: 'Synth',
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.1 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.5, decay: 0.5, sustain: 0.3, release: 0.5 },
        harmonicity: 3.1,
        modulationIndex: 16,
        effects: {
          eq: { low: -6, mid: 0, high: 6 },
          reverb: { decay: 0.8, wet: 0.1 }
        }
      };
      break;
      
    case 'custom':
      // 自定义乐器 - 不改变当前参数
      break;
      
    default:
      resetSynthParams();
  }
  
  // 更新UI
  updateParamsUI();
  
  // 根据合成器类型显示/隐藏相关参数
  const synthType = customSynthParams.synthType;
  const modulationParams = document.getElementById('modulation-params');
  const modulationIndexContainer = document.getElementById('modulation-index-container');
  
  if (synthType === 'AMSynth' || synthType === 'FMSynth') {
    modulationParams.style.display = 'block';
    
    if (synthType === 'FMSynth') {
      modulationIndexContainer.style.display = 'block';
    } else {
      modulationIndexContainer.style.display = 'none';
    }
  } else {
    modulationParams.style.display = 'none';
  }
}

// 重置参数到默认值
function resetSynthParams() {
  customSynthParams = {
    synthType: 'Synth',
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 1.0 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.5, decay: 0.5, sustain: 0.3, release: 0.5 },
    harmonicity: 1.0,
    modulationIndex: 5,
    effects: {
      eq: { low: 0, mid: 0, high: 0 },
      reverb: { decay: 1.2, wet: 0.15 }
    }
  };
}

// 更新参数UI
function updateParamsUI() {
  // 设置选择框
  document.getElementById('synth-type').value = customSynthParams.synthType;
  document.getElementById('oscillator-type').value = customSynthParams.oscillator.type;
  document.getElementById('modulation-type').value = customSynthParams.modulation.type;
  
  // 设置滑块和显示值
  document.getElementById('attack').value = customSynthParams.envelope.attack;
  document.getElementById('attack-value').textContent = customSynthParams.envelope.attack.toFixed(3);
  
  document.getElementById('decay').value = customSynthParams.envelope.decay;
  document.getElementById('decay-value').textContent = customSynthParams.envelope.decay.toFixed(3);
  
  document.getElementById('sustain').value = customSynthParams.envelope.sustain;
  document.getElementById('sustain-value').textContent = customSynthParams.envelope.sustain.toFixed(2);
  
  document.getElementById('release').value = customSynthParams.envelope.release;
  document.getElementById('release-value').textContent = customSynthParams.envelope.release.toFixed(3);
  
  document.getElementById('harmonicity').value = customSynthParams.harmonicity;
  document.getElementById('harmonicity-value').textContent = customSynthParams.harmonicity.toFixed(1);
  
  document.getElementById('modulation-index').value = customSynthParams.modulationIndex;
  document.getElementById('modulation-index-value').textContent = customSynthParams.modulationIndex.toFixed(1);
  
  document.getElementById('eq-low').value = customSynthParams.effects.eq.low;
  document.getElementById('eq-low-value').textContent = customSynthParams.effects.eq.low;
  
  document.getElementById('eq-mid').value = customSynthParams.effects.eq.mid;
  document.getElementById('eq-mid-value').textContent = customSynthParams.effects.eq.mid;
  
  document.getElementById('eq-high').value = customSynthParams.effects.eq.high;
  document.getElementById('eq-high-value').textContent = customSynthParams.effects.eq.high;
  
  document.getElementById('reverb-decay').value = customSynthParams.effects.reverb.decay;
  document.getElementById('reverb-decay-value').textContent = customSynthParams.effects.reverb.decay.toFixed(1);
  
  document.getElementById('reverb-wet').value = customSynthParams.effects.reverb.wet;
  document.getElementById('reverb-wet-value').textContent = customSynthParams.effects.reverb.wet.toFixed(2);
}

// 保存自定义乐器
function saveCustomInstrument() {
  const name = document.getElementById('custom-name').value.trim();
  
  if (!name) {
    alert('请输入乐器名称');
    return;
  }
  
  // 保存当前参数
  savedInstruments[name] = JSON.parse(JSON.stringify(customSynthParams));
  
  // 保存到本地存储
  localStorage.setItem('savedInstruments', JSON.stringify(savedInstruments));
  
  // 更新显示
  updateSavedInstrumentsList();
  
  // 提示用户
  alert(`乐器 "${name}" 已保存`);
  
  // 清空输入框
  document.getElementById('custom-name').value = '';
}

// 加载保存的自定义乐器
function loadSavedInstruments() {
  const saved = localStorage.getItem('savedInstruments');
  if (saved) {
    savedInstruments = JSON.parse(saved);
    updateSavedInstrumentsList();
  }
  
  // 初始显示/隐藏自定义乐器面板
  document.getElementById('custom-instrument-panel').style.display = 'none';
}

// 更新已保存乐器列表
function updateSavedInstrumentsList() {
  const container = document.getElementById('saved-instruments-list');
  container.innerHTML = '';
  
  for (const name in savedInstruments) {
    const button = document.createElement('button');
    button.className = 'px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors flex items-center';
    button.innerHTML = `
      <span>${name}</span>
      <span class="ml-1 text-blue-500 hover:text-red-500" data-name="${name}" title="删除">×</span>
    `;
    
    // 点击加载乐器
    button.addEventListener('click', function(e) {
      // 如果点击的是删除按钮，则不加载乐器
      if (e.target.hasAttribute('data-name')) {
        return;
      }
      
      loadCustomInstrument(name);
    });
    
    // 删除按钮
    const deleteBtn = button.querySelector('[data-name]');
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteCustomInstrument(name);
    });
    
    container.appendChild(button);
  }
  
  // 如果没有保存的乐器，显示提示
  if (Object.keys(savedInstruments).length === 0) {
    const message = document.createElement('p');
    message.className = 'text-sm text-gray-500';
    message.textContent = '暂无保存的乐器';
    container.appendChild(message);
  }
}

// 加载自定义乐器
function loadCustomInstrument(name) {
  if (savedInstruments[name]) {
    // 复制参数
    customSynthParams = JSON.parse(JSON.stringify(savedInstruments[name]));
    
    // 更新UI
    updateParamsUI();
    
    // 切换到自定义乐器
    document.getElementById('instrument').value = 'custom';
    
    // 显示自定义乐器面板
    document.getElementById('custom-instrument-panel').style.display = 'block';
    
    // 应用参数
    ensureAudioContext().then(() => {
      playSimpleScore(document.getElementById('score').value);
    });
  }
}

// 删除自定义乐器
function deleteCustomInstrument(name) {
  if (confirm(`确定要删除乐器 "${name}" 吗？`)) {
    delete savedInstruments[name];
    
    // 更新本地存储
    localStorage.setItem('savedInstruments', JSON.stringify(savedInstruments));
    
    // 更新显示
    updateSavedInstrumentsList();
  }
}

// 添加应用当前乐器参数的函数
function applyCurrentInstrumentParams() {
  // 获取当前乐器类型
  const instrumentType = document.getElementById('instrument').value;
  
  // 如果是自定义乐器，使用当前参数
  if (instrumentType === 'custom') {
    // 应用当前参数
    playSimpleScore(document.getElementById('score').value);
    return;
  }
  
  // 否则，初始化参数并应用
  initParamsFromCurrentInstrument();
  playSimpleScore(document.getElementById('score').value);
} 