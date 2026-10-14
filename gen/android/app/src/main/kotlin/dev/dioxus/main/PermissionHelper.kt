// Copyright 2020-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

package dev.dioxus.main

// taken from https://github.com/ionic-team/capacitor/blob/6658bca41e78239347e458175b14ca8bd5c1d6e8/android/capacitor/src/main/java/com/getcapacitor/PermissionHelper.java

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import java.util.ArrayList

object PermissionHelper {
  /**
   * Checks if a list of given permissions are all granted by the user
   *
   * @param permissions Permissions to check.
   * @return True if all permissions are granted, false if at least one is not.
   */
  fun hasPermissions(context: Context?, permissions: Array<String>): Boolean {
    if (context == null) {
      return false
    }
    for (permission in permissions) {
      if (!hasPermission(context, permission)) {
        return false
      }
    }
    return true
  }

  /**
   * Check whether a permission has been granted by the user
   *
   * @param permission A permission to check.
   * @return True if the permission has been granted, false if not.
   */
  fun hasPermission(context: Context, permission: String): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
  }

  /**
   * Check whether the given permission has been defined in the AndroidManifest.xml
   *
   * @param permission A permission to check.
   * @return True if the permission has been defined in the Manifest, false if not.
   */
  fun hasDefinedPermission(context: Context, permission: String): Boolean {
    return try {
      val packageInfo = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
      val requestedPermissions = packageInfo.requestedPermissions
      for (requestedPermission in requestedPermissions) {
        if (requestedPermission == permission) {
          return true
        }
      }
      false
    } catch (ex: PackageManager.NameNotFoundException) {
      false
    }
  }

  /**
   * Check whether all of the given permissions have been defined in the AndroidManifest.xml
   * @param context the app context
   * @param permissions a list of permissions
   * @return true only if all permissions are defined in the AndroidManifest.xml
   */
  fun hasDefinedPermissions(context: Context, permissions: Array<String>): Boolean {
    for (permission in permissions) {
      if (!hasDefinedPermission(context, permission)) {
        return false
      }
    }
    return true
  }

  /**
   * Get the permissions defined in AndroidManifest.xml
   *
   * @return The permissions defined in AndroidManifest.xml
   */
  private fun getManifestPermissions(context: Context): Array<String>? {
    return try {
      val packageInfo = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
      packageInfo.requestedPermissions
    } catch (ex: PackageManager.NameNotFoundException) {
      null
    }
  }

  /**
   * Given a list of permissions, return a new list with the ones not present in AndroidManifest.xml
   *
   * @param neededPermissions The permissions needed.
   * @return The permissions not present in AndroidManifest.xml
   */
  fun getUndefinedPermissions(context: Context, neededPermissions: Array<String?>): Array<String?> {
    val manifestPermissions = getManifestPermissions(context) ?: return neededPermissions
    val neededPermissionsList = ArrayList(listOf(*neededPermissions))
    for (permission in neededPermissions) {
      for (manifestPermission in manifestPermissions) {
        if (permission == manifestPermission) {
          neededPermissionsList.remove(permission)
          break
        }
      }
    }
    return neededPermissionsList.toTypedArray()
  }
}
