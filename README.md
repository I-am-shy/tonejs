# 基于 Tone.js 的简易数字乐谱演奏工具

**乐谱示例**
(小星星)
```
BPM:120
1-2 1-2 5-2 5-2 6-2 6-2 5-3 0-1
4-2 4-2 3-2 3-2 2-2 2-2 1-3 0-1
5-2 5-2 4-2 4-2 3-2 3-2 2-3 0-1
5-2 5-2 4-2 4-2 3-2 3-2 2-3 0-1
1-2 1-2 5-2 5-2 6-2 6-2 5-3 0-1
4-2 4-2 3-2 3-2 2-2 2-2 1-3 0-1
```
**乐谱基本结构**
- 可选的 BPM 设置：
   BPM:120
>如果不指定，默认为 120
- 音符表示：每个音符使用 音高-时长 格式表示，以空格分隔
   1-2 0-2 ·1-1 ~1-3
- 音高表示
基本音高：   
1 到 7 对应 C, D, E, F, G, A, B（自然音）
0 表示休止符
八度修饰符：   
· 前缀：升高八度（例如 ·1 表示高八度的 C）   
~ 前缀：降低八度（例如 ~1 表示低八度的 C）   
>默认八度为中央 C 所在的八度（第 4 个八度）
- 时长表示
时长以基本时间单位的倍数表示，基本时间单位为 0.25 秒
例如：   
1 表示 0.25 秒   
2 表示 0.5 秒   
4 表示 1 秒   
0.5 表示 0.125 秒   
- 和弦表示
使用反斜杠 \ 连接同时播放的音符：`1-4\3-4\5-4`
>每个音符都有自己的持续时间   
>和弦的总持续时间由最长的音符决定   
>和弦中不应包含休止符（0）   
>和弦中的音符同时开始播放，但可以在不同时间结束   
- 示例解析
```
BPM:120
1-2 0-2 ·1-1 ~1-3 1-4\3-4\5-4
```
这个乐谱的含义是：
1. 速度为每分钟 120 拍
2. 中央 C (C4) 播放 0.5 秒
3. 休止符持续 0.5 秒
4. 高八度 C (C5) 播放 0.25 秒
5. 低八度 C (C3) 播放 0.75 秒

和弦：同时播放 C4、E4 和 G4，每个音符持续 1 秒
