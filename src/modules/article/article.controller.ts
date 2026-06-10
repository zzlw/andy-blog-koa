import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { Auth } from '@/common/decorators/auth.decorator'
import { Identity } from '@/common/decorators/identity.decorator'
import { SuccessMessage } from '@/common/decorators/success-message.decorator'
import { AuthorRole, RequestIdentity } from '@/constants/role.constant'
import { ArchiveService } from '@/modules/archive/archive.service'
import { ArticleService } from './article.service'
import { ArticleListQueryDTO, CreateArticleDTO, UpdateArticleDTO } from './article.dto'

@Controller('articles')
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly archiveService: ArchiveService,
  ) {}

  @Get()
  list(@Query() query: ArticleListQueryDTO, @Identity() identity: RequestIdentity) {
    return this.articleService.list(query, identity)
  }

  // 注意：静态路由必须声明在 :id 之前
  @Get('archive')
  archive() {
    return this.archiveService.getArchive()
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @Identity() identity: RequestIdentity) {
    return this.articleService.detail(id, identity)
  }

  @Post()
  @Auth()
  @SuccessMessage('发布文章成功')
  create(@Body() dto: CreateArticleDTO) {
    return this.articleService.create(dto)
  }

  @Put(':id')
  @Auth()
  @SuccessMessage('更新文章成功')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateArticleDTO) {
    return this.articleService.update(id, dto)
  }

  @Delete(':id')
  @Auth(AuthorRole.SUPER_ADMIN)
  @SuccessMessage('删除文章成功')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.remove(id)
  }

  @Post(':id/like')
  @SuccessMessage('点赞成功')
  like(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.like(id)
  }
}
