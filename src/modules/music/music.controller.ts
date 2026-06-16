import { FastifyRequest } from 'fastify'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common'
import { Auth } from '@/common/decorators/auth.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { UploadFailedException } from '@/common/exceptions/biz.exception'
import { AuthorRole } from '@/constants/role.constant'
import { APP_CONFIG } from '@/app.config'
import { S3Service } from '@/modules/file/s3.service'
import { MusicService } from './music.service'
import { BatchCreateSongsDTO, CreateSongDTO, UpdateSongDTO } from './music.dto'

/** 从 "Artist - Name.mp3" 文件名解析歌手与曲名（无 " - " 时整体作曲名） */
const parseFilename = (filename: string): { name: string; artist: string } => {
  const sep = filename.indexOf(' - ')
  if (sep > 0) {
    return { artist: filename.slice(0, sep).trim(), name: filename.slice(sep + 3).trim() }
  }
  return { artist: '', name: filename }
}

@Controller('music')
export class MusicController {
  constructor(
    private readonly musicService: MusicService,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  list() {
    return this.musicService.list()
  }

  /**
   * 音频上传（单文件 ≤ 100MB），存入 music/ 前缀，返回 result: { files: [{ url, name, artist }] }
   * 流式上传不缓冲到内存，避免 OOM；前端拿到后填入批量表单，确认元数据再调 POST /music/batch 落库
   */
  @Post('upload')
  @Auth()
  @SuccessMessage('上传成功')
  async upload(@Req() request: FastifyRequest) {
    if (!request.isMultipart()) {
      throw new UploadFailedException('Content-Type 必须为 multipart/form-data')
    }

    const limit = APP_CONFIG.upload.audioLimit
    const files: Array<{ url: string; name: string; artist: string }> = []
    const parts = request.files({ limits: { files: APP_CONFIG.upload.maxCount, fileSize: limit } })
    for await (const part of parts) {
      try {
        const url = await this.s3Service.uploadStream(
          part.filename,
          part.file,
          part.mimetype || 'audio/mpeg',
          APP_CONFIG.s3.musicPrefix,
        )
        if (part.file.truncated) {
          throw new UploadFailedException(
            `音频「${part.filename}」超过大小上限 ${Math.round(limit / 1024 / 1024)}MB`,
          )
        }
        files.push({ url, ...parseFilename(part.filename) })
      } catch (error) {
        if (error instanceof UploadFailedException) throw error
        const code = (error as { code?: string })?.code
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          throw new UploadFailedException(
            `音频「${part.filename}」超过大小上限 ${Math.round(limit / 1024 / 1024)}MB`,
          )
        }
        throw new UploadFailedException('音频上传失败')
      }
    }

    if (!files.length) throw new UploadFailedException('未接收到文件')
    return { files }
  }

  @Post()
  @Auth()
  @SuccessMessage('新增歌曲成功')
  create(@Body() dto: CreateSongDTO) {
    return this.musicService.create(dto)
  }

  @Post('batch')
  @Auth()
  @SuccessMessage('批量新增成功')
  batchCreate(@Body() dto: BatchCreateSongsDTO) {
    return this.musicService.batchCreate(dto.songs)
  }

  @Put(':id')
  @Auth()
  @SuccessMessage('更新歌曲成功')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSongDTO) {
    return this.musicService.update(id, dto)
  }

  @Delete(':id')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('删除歌曲成功')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.musicService.remove(id)
  }
}
