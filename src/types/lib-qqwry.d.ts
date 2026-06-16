declare module 'lib-qqwry' {
  interface QQWryResult {
    int: number
    ip: string
    /** 地理位置（纯真库主字段，国内常到省市区/街道级） */
    Country: string
    /** 运营商 / 机房 / 备注（纯真库副字段） */
    Area: string
  }

  interface QQWry {
    searchIP(ip: string): QQWryResult
  }

  /** @param loadToMemory 为 true 时将 qqwry.dat 全量载入内存，查询更快 */
  function libQQWry(loadToMemory?: boolean): QQWry

  export = libQQWry
}
