import { Connection } from 'mongoose'
import { Inject, Provider } from '@nestjs/common'
import { getModelForClass } from '@typegoose/typegoose'
import { DB_CONNECTION_TOKEN } from './database.module'

type TypegooseClass = new (...args: any[]) => any

export const getModelToken = (modelName: string): string => `${modelName}Model`

/** 基于共享连接为 Typegoose Class 生成 NestJS Provider */
export const getModelProvider = (typegooseClass: TypegooseClass): Provider => ({
  provide: getModelToken(typegooseClass.name),
  inject: [DB_CONNECTION_TOKEN],
  useFactory: (connection: Connection) =>
    getModelForClass(typegooseClass, { existingConnection: connection }),
})

/** 注入模型：@InjectModel(Article) */
export const InjectModel = (typegooseClass: TypegooseClass) =>
  Inject(getModelToken(typegooseClass.name))
