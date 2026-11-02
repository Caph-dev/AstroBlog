# 上游 qijie233/meting-api-enhanced 自带的 Dockerfile 已过期（`node:lts-alpine`
# 里没有 yarn，而仓库实际用的是 pnpm），所以这里自带一份构建定义。
# 构建时 context 指向上游仓库 checkout，本文件路径由 workflow 的 file 参数指定。
FROM node:22-alpine

RUN apk add --no-cache tini

ENV NODE_ENV=production
WORKDIR /app

# 先装依赖，利用层缓存
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@9 \
 && pnpm install --prod --frozen-lockfile --ignore-scripts

COPY . ./

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "app.js"]
