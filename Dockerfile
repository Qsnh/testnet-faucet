FROM node:14

# Create app directory
WORKDIR /usr/src/app

COPY tsconfig.json ./
COPY state.json ./
COPY app ./app
COPY package.json ./
COPY yarn.lock ./
RUN yarn
COPY . . 


EXPOSE 2880

CMD [ "yarn", "start" ]
