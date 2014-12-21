#!/usr/bin/env python
# -*- coding: utf-8 -*-
######################################################################
# xpi packaging tool
# Copyright (c) 2014 uFFFD
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import sys
import zipfile
import os
import os.path
import glob
import re
from collections import OrderedDict


def normalize_path(path):
    path = os.path.normpath(path)
    relpath = os.path.relpath(path)
    if relpath.startswith(".."):
        return path
    else:
        return relpath


def list_dir(path):
    li = []
    for root, dirs, files in os.walk(path):
        if len(files) > 0:
            li.extend((os.path.join(root, f) for f in files))
    return li


def get_files(path):
    li = []
    path = normalize_path(path)
    if os.path.isfile(path):
        li.append(path)
    elif os.path.isdir(path):
        li.extend(list_dir(path))
    else:
        print("{0} is not file / dir, ignore".format(p))
    return li


def build_xpi(argv):
    pyself = argv[0]
    dest = argv[1]
    sources = argv[2:]

    print("Scanning...")

    files_to_add = []

    patt = re.compile(r"\*|\?|\[(\w-\w|\w)+\]")
    for i in sources:
        if patt.search(i):
            for j in glob.iglob(i):
                files_to_add.extend(get_files(j))
        elif os.path.exists(i):
            files_to_add.extend(get_files(i))
        else:
            print("{0} doesn't exist, ignore".format(i))

    # remove duplicates
    files_to_add = list(OrderedDict.fromkeys(files_to_add))

    # avoid adding dest to itself
    out = normalize_path(dest)
    if out in files_to_add:
        files_to_add.remove(out)

    if not files_to_add:
        print("WARNING: Nothing to add to {0}".format(dest))
        return

    if os.path.exists(out):
        if os.path.isdir(out):
            print("ERROR: {0} is a directory".format(dest))
            return
        if out == normalize_path(pyself):
            print("ERROR: Should not write to {0}".format(pyself))
            return

    print("\nBuilding {0}...\n".format(dest))
    try:
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as xpi:
            for f in files_to_add:
                print("  add {0}".format(f))
                xpi.write(f)
    except Exception as e:
        print(e)
        return
    print("\nDone")


def print_help():
    basename = os.path.basename(sys.argv[0])
    print("Usage: {0} <out.xpi> <infile1> [infile2...]".format(basename))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print_help()
    else:
        build_xpi(sys.argv)
