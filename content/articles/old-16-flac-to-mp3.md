---
id: 16
title: 用 ffmpeg 批量把 flac 转成 mp3：一条命令搞定整目录
description: flac 无损好听但体积大、设备兼容性一般。用 ffmpeg 一条循环命令就能批量转成 mp3，还能保留元数据与封面。附码率选择与常见参数说明。
cover: ""
category: 工具与效率
tags: [ffmpeg, 命令行, 音频]
created_date: 2016-12-14
status: published
public: true
star: false
---

flac 是无损格式，音质好但体积大、部分老设备/车机不认。转成 mp3 体积小、兼容性好。用 **ffmpeg** 一条命令就能批量搞定整个目录，还能保留歌曲信息和封面。

## 单个文件

```bash
ffmpeg -i input.flac -ab 320k -map_metadata 0 -id3v2_version 3 output.mp3
```

参数说明：

- `-i input.flac`：输入文件；
- `-ab 320k`：音频码率 320kbps（mp3 的实用上限，音质足够好）；
- `-map_metadata 0`：把源文件的元数据（歌手、专辑、年份等）复制过来；
- `-id3v2_version 3`：用 ID3v2.3 标签，兼容性最好。

## 批量转换整个目录

用 shell 循环遍历所有 flac：

```bash
# 在含 flac 的目录里执行
for f in *.flac; do
  ffmpeg -i "$f" -ab 320k -map_metadata 0 -id3v2_version 3 "${f%.flac}.mp3"
done
```

`"${f%.flac}.mp3"` 是参数展开——去掉 `.flac` 后缀换成 `.mp3`，保证输出文件名和原文件对应。文件名带空格务必加引号 `"$f"`。

## 递归处理子目录

按专辑分文件夹存放时，用 `find` 递归：

```bash
find . -name "*.flac" -exec sh -c '
  ffmpeg -i "$1" -ab 320k -map_metadata 0 -id3v2_version 3 "${1%.flac}.mp3"
' _ {} \;
```

## 码率怎么选

- **320k（CBR）**：mp3 实用最高音质，体积约为 flac 的 1/3，绝大多数场景够用；
- **`-q:a 0`（VBR）**：可变码率最高质量，体积更优、音质相近，更推荐：

```bash
ffmpeg -i input.flac -q:a 0 -map_metadata 0 output.mp3
```

VBR 让 ffmpeg 按音频复杂度动态分配码率，同等音质下文件更小。

## 保留封面

带内嵌封面的 flac，加上视频流映射保留封面图：

```bash
ffmpeg -i input.flac -ab 320k -map 0:a -map 0:v? -c:v copy -map_metadata 0 output.mp3
```

`-map 0:v?` 里的 `?` 表示「有就拷、没有也不报错」。

## 小结

ffmpeg 批量转码就是「一条命令 + 一个循环」：`-ab 320k`（或 `-q:a 0` 走 VBR）定音质、`-map_metadata 0` 保元数据、shell 的 `for` 或 `find` 做批量。记得给文件名加引号防空格，需要封面就加 `-map 0:v?`。一行命令搞定整张专辑。
