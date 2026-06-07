pipeline {
    agent any
    
    triggers {
        // Ejecución programada automáticamente todos los días
        cron('0 8 * * *\n10 15 * * *')
    }
    
    parameters {
        string(name: 'PROJECT_KEY', defaultValue: 'demo-app-devsecops', description: 'ID del proyecto en SonarQube')
        string(name: 'PROJECT_NAME', defaultValue: 'Demo App Security', description: 'Nombre del proyecto')
        
        // Caso Local o Caso Git
        choice(name: 'ORIGEN_CODIGO', 
               choices: ['https://github.com/Akun2-DH/devsecops-demo-app.git', 'LOCAL'], 
               description: 'Selecciona si usas el codigo local de Ubuntu o el repositorio de GitHub')
        
        // Desplegable para elegir a qué IP/Contenedor atacar 
        choice(name: 'TARGET_URL', 
               choices: ['http://devsecops-demo-app:3000', 'http://10.2.15.220:8080'], 
               description: 'Selecciona el objetivo DAST: El contenedor interno o la IP de la maquina externa')
    }

    environment {
        // Cargamos ambas credenciales de forma segura desde el almacén de Jenkins
        ZAP_API_KEY = credentials('ZAP_API_KEY')
        GITHUB_AUTH = credentials('GITHUB_TOKEN_API')
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    if (params.ORIGEN_CODIGO == 'LOCAL') {
                        echo "Analizando codigo local preexistente en la maquina"
                    } else {
                        echo "Clonando codigo desde repositorio remoto: ${params.ORIGEN_CODIGO}"
                        git url: "${params.ORIGEN_CODIGO}", branch: 'main'
                    }
                }
            }
        }

        stage('SAST - SonarQube') {
            steps {
                withSonarQubeEnv('SonarQube-DevSecOps') {
                    sh """
                        sonar-scanner \
                        -Dsonar.projectKey=${params.PROJECT_KEY} \
                        -Dsonar.projectName="${params.PROJECT_NAME}" \
                        -Dsonar.sources=. \
                        -Dsonar.host.url=\$SONAR_HOST_URL \
                        -Dsonar.login=\$SONAR_AUTH_TOKEN
                    """
                }
            }
        }

        stage('Target Verification') {
            steps {
                echo "Verificando disponibilidad del objetivo: ${params.TARGET_URL}"
                sh "curl -I -s --connect-timeout 10 ${params.TARGET_URL} || (echo 'Error: El objetivo no responde' && exit 1)"
            }
        }

        stage('DAST - OWASP ZAP') {
            options {
                // EVITA CUELGUES: Si tarda más de 5 minutos, Jenkins aborta la etapa de forma segura
                timeout(time: 5, unit: 'MINUTES')
            }
            steps {
                echo "Ejecutando analisis dinamico rapido (Spider Scan) contra: ${params.TARGET_URL}"
                sh """
                    curl -s -H "Host: localhost:8080" \
                    "http://devsecops-zap:8080/JSON/spider/action/scan/?apikey=${ZAP_API_KEY}&url=${params.TARGET_URL}&recurse=true"
                """
            }
        }
    }
    
    post {
        success {
            script {
                if (params.ORIGEN_CODIGO != 'LOCAL') {
                    echo '¡Pipeline exitoso! Notificando estatus VERDE a GitHub mediante API...'
                    def commitHash = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    
                    // CORREGIDO: "state": "success" para que pinte el check verde en GitHub
                    sh """
                        curl -X POST -H "Authorization: token ${GITHUB_AUTH}" \
                        -H "Accept: application/vnd.github.v3+json" \
                        https://api.github.com/repos/Akun2-DH/devsecops-demo-app/statuses/${commitHash} \
                        -d '{"state": "success", "target_url": "${BUILD_URL}", "description": "¡Análisis estático y dinámico superado con éxito!", "context": "Pipeline DevSecOps (Jenkins)"}'
                    """
                } else {
                    echo '¡Pipeline local exitoso! (No se requiere notificación en GitHub)'
                }
            }
        }
        failure {
            script {
                if (params.ORIGEN_CODIGO != 'LOCAL') {
                    echo '¡Pipeline fallido! Notificando estatus ROJO a GitHub mediante API...'
                    def commitHash = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    
                    sh """
                        curl -X POST -H "Authorization: token ${GITHUB_AUTH}" \
                        -H "Accept: application/vnd.github.v3+json" \
                        https://api.github.com/repos/Akun2-DH/devsecops-demo-app/statuses/${commitHash} \
                        -d '{"state": "failure", "target_url": "${BUILD_URL}", "description": "Fallo de seguridad detectado en el pipeline.", "context": "Pipeline DevSecOps (Jenkins)"}'
                    """
                } else {
                    echo '¡Pipeline local fallido! (No se requiere notificación en GitHub)'
                }
            }
        }
        always {
            cleanWs(deleteDirs: true, notFailBuild: true, disableDeferredWipeout: true)
            echo "¡Pipeline de DevSecOps finalizado!"
        }
    }
}
