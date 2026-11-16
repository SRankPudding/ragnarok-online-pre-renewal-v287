FROM debian:13-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates cmake git libmariadb-dev-compat zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

ARG RATHENA_REV
ARG PACKETVER
WORKDIR /src
RUN git init && git remote add origin https://github.com/rathena/rathena.git \
    && git fetch --depth=1 origin "$RATHENA_REV" && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$RATHENA_REV"
COPY patches/ /tmp/server-patches/
RUN sed -i -f /tmp/server-patches/inventory-voucher.sed src/map/clif.cpp \
    && sed -i -f /tmp/server-patches/pet-loot.sed -f /tmp/server-patches/pet-taming.sed src/map/pet.cpp \
    && sed -i -f /tmp/server-patches/quest-zeny.sed src/map/quest.cpp \
    && sed -i -f /tmp/server-patches/enchant-status.sed src/map/status.cpp \
    && sed -i -f /tmp/server-patches/starter-stat-quest.sed src/map/pc.cpp \
    && sed -i '/^BUILDIN_FUNC(getinventorylist)/e cat /tmp/server-patches/safe-enchant.inc /tmp/server-patches/progression-floor.inc' src/map/script.cpp \
    && sed -i '/BUILDIN_DEF(getinventorylist/i\ BUILDIN_DEF(sroenchant,"iiii"),\n BUILDIN_DEF(sroprogressfloor,"ii"),' src/map/script.cpp \
    && grep -q 'BUILDIN_FUNC(sroenchant)' src/map/script.cpp \
    && grep -q 'BUILDIN_FUNC(sroprogressfloor)' src/map/script.cpp
RUN ./configure --enable-prere=yes --enable-packetver="$PACKETVER" \
    && make -j2 login char map import

FROM debian:13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmariadb3 libstdc++6 zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 rathena \
    && useradd --uid 10001 --gid rathena --no-create-home rathena
WORKDIR /opt/rathena
COPY --from=build /src/login-server /src/char-server /src/map-server ./
COPY --from=build /src/conf/ ./conf/
COPY --from=build /src/db/ ./db/
COPY --from=build /src/npc/ ./npc/
RUN install -d -o rathena -g rathena log
USER rathena
