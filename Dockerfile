FROM node:24-alpine
ENV NODE_ENV=production PORT=3080
WORKDIR /app
COPY --chown=node:node package.json core.mjs services.mjs server.mjs ./
COPY --chown=node:node public ./public
USER node
EXPOSE 3080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
