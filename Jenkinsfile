pipeline {
  agent any
  stages {
    stage('Install') { steps { sh 'npm ci' } }
    stage('Build') { steps { sh 'npm run build' } }
    stage('Test') { steps { sh 'npm test && npm run evaluate' } }
    stage('Package') { steps { sh 'docker build -t arenaboard:$BUILD_NUMBER .' } }
  }
}
