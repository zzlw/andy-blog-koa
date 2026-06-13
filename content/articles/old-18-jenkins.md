---
id: 18
title: Jenkins 不完全指南：从安装到流水线即代码
description: Jenkins 是老牌的开源持续集成工具。一篇覆盖核心概念、安装、声明式 Pipeline、凭据管理与最佳实践的实用指南，帮你把构建-测试-部署自动化跑起来。
cover: ""
category: 云原生与交付
tags: [Jenkins, CI-CD, DevOps]
created_date: 2023-02-06
status: published
public: true
star: true
---

Jenkins 是一款由 Java 编写的开源持续集成 / 持续交付（CI/CD）工具。它的核心价值是：把「拉代码 → 构建 → 测试 → 部署」这条本该重复手动的流程，变成可自动触发、可追溯、可复用的流水线。这篇是一份能让你跑起来的实用指南。

## 核心概念

- **Job / Pipeline**：一个可执行的任务。现代用法几乎都是 **Pipeline**（流水线）。
- **Stage / Step**：流水线里的阶段（如 Build、Test、Deploy）与具体步骤。
- **Agent / Node**：实际跑构建的执行机，可以是主节点或分布式从节点。
- **Trigger**：触发方式，常见是「代码 push（webhook）」「定时」「手动」。
- **Credentials**：集中管理的密钥（Git 凭据、SSH key、Token），**绝不写进脚本**。

## 安装（Docker 最快）

```bash
docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts
# 首次启动拿初始管理员密码：
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

`jenkins_home` 卷一定要持久化——所有任务、插件、配置都在里面，丢了就全没了。

## Pipeline as Code（声明式）

把流水线写进仓库根目录的 `Jenkinsfile`，让 CI 流程和代码一起版本化：

```groovy
pipeline {
  agent any
  environment {
    REGISTRY = 'registry.example.com/myapp'
  }
  stages {
    stage('Build') {
      steps { sh 'npm ci && npm run build' }
    }
    stage('Test') {
      steps { sh 'npm test' }
    }
    stage('Docker') {
      steps {
        sh "docker build -t $REGISTRY:${GIT_COMMIT} ."
        sh "docker push $REGISTRY:${GIT_COMMIT}"
      }
    }
    stage('Deploy') {
      when { branch 'main' }   // 只在 main 分支部署
      steps { sh './scripts/deploy.sh ${GIT_COMMIT}' }
    }
  }
  post {
    failure { echo '构建失败，触发通知' }
    always  { cleanWs() }      // 清理工作空间
  }
}
```

声明式 Pipeline 的好处：流程透明、可 review、可回溯，换台 Jenkins 也能照样跑。

## 凭据管理

千万别把密码/Token 写进 `Jenkinsfile`。用 Jenkins 的 Credentials 体系存储，用 `withCredentials` 注入：

```groovy
withCredentials([usernamePassword(
  credentialsId: 'registry-cred',
  usernameVariable: 'USER', passwordVariable: 'PASS')]) {
  sh 'echo "$PASS" | docker login -u "$USER" --password-stdin $REGISTRY'
}
```

密钥只存一处、加密保管、日志里自动打码。

## 最佳实践

1. **Pipeline as Code**：流水线进仓库，别在 UI 里手点配置（不可追溯、易丢失）。
2. **构建产物按 commit 打 tag**：`$GIT_COMMIT` 作镜像 tag，保证可追溯、可回滚。
3. **分支策略**：`when { branch 'main' }` 控制只有主分支才部署生产。
4. **失败要有通知**：`post { failure { ... } }` 接入钉钉/邮件/企业微信。
5. **定期清理**：`cleanWs()` + 构建历史保留策略，防磁盘吃满。

## 与轻量方案的取舍

如今 GitHub Actions、GitLab CI 这类「仓库内置 CI」对中小项目更省心（无需自建、维护）。Jenkins 的优势在**高度可定制、插件生态庞大、可私有化掌控**，适合复杂企业场景或对构建环境有强管控需求的团队。

## 小结

Jenkins 把 CI/CD 流程自动化、可追溯。用 Docker 快速起、用 `Jenkinsfile` 把流水线写成代码、用 Credentials 管好密钥、用 commit tag 保证可回滚——这套实践能让你的构建-测试-部署既自动又稳。
