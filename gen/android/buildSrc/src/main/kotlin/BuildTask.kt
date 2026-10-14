import java.io.File
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

abstract class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun build() {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")

        val argsList = mutableListOf<String>()
        argsList.add("android")
        argsList.add("build")
        if (project.logger.isEnabled(LogLevel.DEBUG)) {
            argsList.add("-vv")
        } else if (project.logger.isEnabled(LogLevel.INFO)) {
            argsList.add("-v")
        }
        if (release) {
            argsList.add("--release")
        }
        argsList.add(target)

        val processBuilder = ProcessBuilder(argsList)
        processBuilder.directory(File(project.projectDir, rootDirRel))
        processBuilder.inheritIO()
        val process = processBuilder.start()
        val exitCode = process.waitFor()
        if (exitCode != 0) {
            throw GradleException("cargo android build failed with exit code $exitCode")
        }
    }
}
