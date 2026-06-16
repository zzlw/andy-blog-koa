import { Model } from 'mongoose'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel } from '@/core/database/model.transformer'
import { NotFoundException } from '@/common/exceptions/biz.exception'
import { Song } from './music.model'
import { CreateSongDTO, UpdateSongDTO } from './music.dto'
import { SONG_SEED } from './music.seed'

@Injectable()
export class MusicService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MusicService.name)

  constructor(@InjectModel(Song) private readonly songModel: Model<Song>) {}

  /** 空集合时导入初始歌单（迁移旧静态配置），幂等：仅在 songs 为空时执行一次 */
  async onApplicationBootstrap() {
    const count = await this.songModel.countDocuments({}).exec()
    if (count > 0) return
    // 顺序插入：AutoIncrementID 首次会创建计数器文档，并行插入会在该文档上产生
    // E11000 唯一键冲突，故逐条 await（仅启动时一次性导入，开销可忽略）
    for (let index = 0; index < SONG_SEED.length; index++) {
      await this.songModel.create({ ...SONG_SEED[index], sort: index })
    }
    this.logger.log(`已导入初始歌单 ${SONG_SEED.length} 首`)
  }

  /** 公开列表：按 sort、id 升序返回全部（供前台播放器一次性加载） */
  list() {
    return this.songModel.find().sort({ sort: 1, id: 1 }).lean().exec()
  }

  create(dto: CreateSongDTO) {
    return this.songModel.create({ ...dto })
  }

  /** 批量新增（后台批量上传后落库元数据），保持提交顺序的 sort 递增 */
  async batchCreate(songs: CreateSongDTO[]) {
    const [maxDoc] = await this.songModel.find().sort({ sort: -1 }).limit(1).lean().exec()
    const base = (maxDoc?.sort ?? -1) + 1
    // 逐条插入，避免并行触发 AutoIncrementID 计数器竞争；
    // sort 放在展开之后，避免 DTO 里 sort: undefined 覆盖计算值
    const created: Song[] = []
    for (let index = 0; index < songs.length; index++) {
      created.push(await this.songModel.create({ ...songs[index], sort: base + index }))
    }
    return created
  }

  async update(id: number, dto: UpdateSongDTO) {
    const song = await this.songModel
      .findOneAndUpdate({ id }, { $set: dto }, { new: true })
      .lean()
      .exec()
    if (!song) throw new NotFoundException('歌曲不存在')
    return song
  }

  async remove(id: number) {
    const result = await this.songModel.deleteOne({ id }).exec()
    if (!result.deletedCount) throw new NotFoundException('歌曲不存在')
  }
}
