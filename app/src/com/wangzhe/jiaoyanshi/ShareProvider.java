package com.wangzhe.jiaoyanshi;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Minimal FileProvider replacement (avoid AndroidX dependency).
 * Serves files from cacheDir/share/ as content://com.wangzhe.jiaoyanshi.share/share/<name>
 * so the app can share generated PNG images with a readable content URI on Android 7+.
 */
public class ShareProvider extends ContentProvider {

    public static final String AUTHORITY = "com.wangzhe.jiaoyanshi.share";

    @Override
    public boolean onCreate() {
        return true;
    }

    private File resolve(Uri uri) {
        String path = uri.getPath();
        if (path == null) {
            return null;
        }
        // path looks like /share/xxx.png
        String name = path.startsWith("/share/") ? path.substring("/share/".length()) : path.replaceFirst("^/", "");
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            return null;
        }
        File dir = new File(getContext().getCacheDir(), "share");
        return new File(dir, name);
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = resolve(uri);
        if (file == null || !file.exists()) {
            throw new FileNotFoundException(String.valueOf(uri));
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        File file = resolve(uri);
        String name = file == null ? "" : file.getName();
        String ext = MimeTypeMap.getFileExtensionFromUrl(name);
        String type = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return type == null ? "image/png" : type;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
