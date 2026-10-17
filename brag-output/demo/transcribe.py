import json
from pathlib import Path
from faster_whisper import WhisperModel
root=Path(__file__).resolve().parents[1]
model=WhisperModel('C:/Users/Mursaleen/.cache/huggingface/hub/models--Systran--faster-whisper-base/snapshots/ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66',device='cpu',compute_type='int8')
segments,info=model.transcribe(str(root/'composition/assets/voiceover.wav'),language='en',word_timestamps=True,initial_prompt='OraVision AI. EfficientNet B zero. YOLO. Clinical-risk prioritization.')
words=[]
for s in segments:
 print(f'{s.start:.2f}–{s.end:.2f}: {s.text}',flush=True)
 for w in s.words: words.append(dict(id=f'w{len(words)}',text=w.word.strip(),start=w.start,end=w.end))
(root/'composition/transcript.json').write_text(json.dumps(words,indent=2),encoding='utf-8')
